// pages/api/cron/daegu-candidates.js — 대구 소식 후보 공급 (로컬 작성기용)
// 호출: POST /api/cron/daegu-candidates            — 새로 수집
//       POST /api/cron/daegu-candidates?reuse=TOK  — 직전 수집 재사용(재시도용, 수집 생략)
//       Authorization: Bearer {CRON_SECRET}
//
// 작성(모델 호출)은 집 서버 scripts/daegu-write.mjs가 구독 claude로 하고,
// 검증·저장은 daegu-save.js가 한다. 이 엔드포인트는 소재만 넘긴다.

import { collectAllCandidates } from "../../../lib/collect";
import { filterUnseenLinks, listDaeguIds, getDaeguPost } from "../../../lib/redis";
import {
  MAX_CANDIDATES_TO_AI,
  RECENT_TITLES_FOR_DEDUP,
  todayKst,
  saveBatch,
  loadBatch,
} from "../../../lib/daegu-core";

export const config = { maxDuration: 120 };

// Redis 배치에 담을 필드 — 프롬프트(description)·검증(link/type)·이미지 폴백(image/title)에
// 필요한 것만. 수집기가 붙이는 그 외 부가 필드는 버린다.
const compact = (c) => ({
  link: c.link,
  title: c.title,
  type: c.type,
  description: c.description || "",
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
    const reuse = String(req.query.reuse || "").trim();

    // 재시도 회차는 직전 수집 결과를 그대로 쓴다 — 4일치 수집을 매번 반복하지 않도록
    let all = null;
    let reused = false;
    if (reuse) {
      const prev = await loadBatch(reuse);
      if (prev && Array.isArray(prev.all) && prev.all.length) {
        all = prev.all;
        reused = true;
      }
    }

    // 수집 4일: 축제 예고 기사가 행사 직전에 범위 밖으로 밀리지 않게
    if (!all) all = (await collectAllCandidates({ days: 4 })).map(compact);

    if (!all.length) {
      return res.status(200).json({ ok: true, empty: true, reason: "후보 없음(수집 0건)" });
    }

    // 소스별 수집 현황 — 네이버 env 미적용 등 수집 이상을 로그에서 바로 보이게
    const sourceMix = {
      gnews: all.filter((c) => (c.link || "").includes("news.google.com")).length,
      naver: all.filter((c) => !(c.link || "").includes("news.google.com") && c.type !== "official").length,
      official: all.filter((c) => c.type === "official").length,
    };

    // 이번 회차에 쓸 수 있는 소재만 — 직전 시도에서 소진(seen)된 링크는 빠진다
    const unseen = new Set(await filterUnseenLinks(all.map((c) => c.link)));
    const fresh = all.filter((c) => unseen.has(c.link)).slice(0, MAX_CANDIDATES_TO_AI);

    if (!fresh.length) {
      return res.status(200).json({ ok: true, empty: true, reason: "새 소재 없음(전부 사용됨)" });
    }

    const recentIds = await listDaeguIds(RECENT_TITLES_FOR_DEDUP);
    const recentTitles = (await Promise.all(recentIds.map((rid) => getDaeguPost(rid))))
      .map((p) => p && p.title)
      .filter(Boolean);

    const today = todayKst();

    // 이 회차 스냅샷을 저장 — 저장 단계가 "모델이 실제로 본 후보"로 검증하도록
    const batch = await saveBatch({ all, fresh, recentTitles, today });

    return res.status(200).json({
      ok: true,
      batch,
      today,
      reused,
      candidates: fresh,
      recentTitles,
      totalCandidates: all.length,
      fresh: fresh.length,
      sourceMix,
      elapsed: Date.now() - t0,
    });
  } catch (e) {
    console.error("daegu-candidates error:", e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
