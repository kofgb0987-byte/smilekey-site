// pages/api/cron/daegu-candidates.js — 대구 소식 후보 공급 (로컬 작성기용)
// 호출: POST /api/cron/daegu-candidates
//       Authorization: Bearer {CRON_SECRET}
//
// 작성(모델 호출)은 집 서버 scripts/daegu-write.mjs가 구독 claude로 하고,
// 검증·저장은 daegu-save.js가 한다. 이 엔드포인트는 소재만 넘긴다.
// 재시도 회차도 그냥 다시 부른다 — 수집 4초라 캐시할 가치가 없고, 직전 시도에서
// 소진(seen)된 링크가 자연히 빠진다.

import { collectAllCandidates } from "../../../lib/collect";
import { filterUnseenLinks, listDaeguIds, getDaeguPost } from "../../../lib/redis";
import { sourceMixOf, pickBalancedCandidates } from "../../../lib/candidates";
import {
  MAX_CANDIDATES_TO_AI,
  RECENT_TITLES_FOR_DEDUP,
  todayKst,
  saveBatch,
} from "../../../lib/daegu-core";

export const config = { maxDuration: 120 };

// Redis 스냅샷에 담을 필드 — 검증(link/type)·이미지 폴백(image/title)에 필요한 것만.
// 프롬프트용 본문(description)은 HTTP 응답에만 싣는다.
const compact = (c) => ({
  link: c.link,
  title: c.title,
  type: c.type,
  image: c.image || "",
  date: c.date || "",
});

export default async function handler(req, res) {
  const auth = req.headers.authorization || "";
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const t0 = Date.now();
    const timings = {};

    // 수집 4일: 축제 예고 기사가 행사 직전에 범위 밖으로 밀리지 않게
    const all = await collectAllCandidates({ days: 4 });
    timings.collect = Date.now() - t0;
    if (!all.length) {
      return res.status(200).json({ ok: true, empty: true, reason: "후보 없음(수집 0건)" });
    }

    // 소스별 수집 현황 — 네이버 env 미적용 등 수집 이상을 로그에서 바로 보이게
    const sourceMix = sourceMixOf(all);

    // 이번 회차에 쓸 수 있는 소재만 — 직전 시도에서 소진(seen)된 링크는 빠진다.
    // 소스(구글·네이버뉴스·블로그·공식)별로 균형 있게 뽑는다 — 최신순 단순 절단은
    // 오늘 뉴스만으로 40건이 차 블로그·공식 행사·전날 예고가 전부 잘렸음(09-19 한마음축제 누락)
    const t1 = Date.now();
    const unseen = new Set(await filterUnseenLinks(all.map((c) => c.link)));
    timings.unseen = Date.now() - t1;
    const fresh = pickBalancedCandidates(
      all.filter((c) => unseen.has(c.link)),
      MAX_CANDIDATES_TO_AI
    );

    if (!fresh.length) {
      return res.status(200).json({ ok: true, empty: true, reason: "새 소재 없음(전부 사용됨)" });
    }

    const t2 = Date.now();
    const recentIds = await listDaeguIds(RECENT_TITLES_FOR_DEDUP);
    const recentTitles = (await Promise.all(recentIds.map((rid) => getDaeguPost(rid))))
      .map((p) => p && p.title)
      .filter(Boolean);
    timings.recent = Date.now() - t2;

    const today = todayKst();

    // 이 회차 스냅샷을 저장 — 저장 단계가 "모델이 실제로 본 후보"로 검증하도록
    const t3 = Date.now();
    const batch = await saveBatch({ fresh: fresh.map(compact), recentTitles, today });
    timings.batch = Date.now() - t3;

    return res.status(200).json({
      ok: true,
      batch,
      today,
      candidates: fresh.map((c) => ({ ...compact(c), description: c.description || "" })),
      recentTitles,
      totalCandidates: all.length,
      fresh: fresh.length,
      sourceMix,
      freshMix: sourceMixOf(fresh),
      timings: { ...timings, total: Date.now() - t0 },
    });
  } catch (e) {
    console.error("daegu-candidates error:", e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
