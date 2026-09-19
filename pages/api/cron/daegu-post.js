// pages/api/cron/daegu-post.js — 대구 소식 자동 발행 (서버 단독 경로, OpenAI)
// 호출: POST /api/cron/daegu-post
//       Authorization: Bearer {CRON_SECRET}
//
// 2026-09-08부터 정규 발행은 집 서버 scripts/daegu-write.mjs(구독 claude -p)가 담당하고,
// 이 엔드포인트는 그 경로가 실패했을 때 infra/daegu-post.ps1이 부르는 폴백이다.
// 흐름: 네이버 뉴스/블로그 수집 → 미사용 링크 필터 → AI가 주제 선택+정보글 작성 → 검증 → 저장
// 검증·저장 규칙은 lib/daegu-core.js 하나를 로컬 경로와 공유한다.

import { collectAllCandidates } from "../../../lib/collect";
import { aiWriteDaeguPost, aiReviewDaeguPost } from "../../../lib/ai";
import { filterUnseenLinks, listDaeguIds, getDaeguPost } from "../../../lib/redis";
import { sourceMixOf, pickBalancedCandidates } from "../../../lib/candidates";
import {
  MAX_CANDIDATES_TO_AI,
  RECENT_TITLES_FOR_DEDUP,
  MAX_ATTEMPTS,
  todayKst,
  validateDraft,
  finalizePost,
} from "../../../lib/daegu-core";

// 재시도 포함 최대 6회 AI 호출 — 기본 한도(수십 초)로는 부족할 수 있음
export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  const auth = req.headers.authorization || "";
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // 수집은 Google 뉴스 RSS가 기본(키 불필요), 네이버 API는 env 있으면 자동 추가
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ ok: false, error: "env 누락: OPENAI_API_KEY" });
  }

  try {
    const t0 = Date.now();
    const timings = {};
    // 1) 수집 — 4일: 축제 예고 기사가 행사 직전에 범위 밖으로 밀리지 않게
    const all = await collectAllCandidates({ days: 4 });
    timings.collect = Date.now() - t0;
    if (!all.length) {
      return res.status(200).json({ ok: true, skipped: "후보 없음(수집 0건)" });
    }
    // 소스별 수집 현황 — 네이버 env 미적용 등 수집 이상을 로그에서 바로 보이게
    const sourceMix = sourceMixOf(all);

    // 2~3) 소재 선정→작성→검수. 선택된 주제가 차단(중복·근거부족·검수거부)되면
    //      해당 소재를 소진(seen)하고 남은 후보로 재시도 — 첫 선택이 막혔다고
    //      회차를 빈손으로 끝내지 않는다(7/30 하루 2회 모두 스킵된 실사고 대응).
    const recentIds = await listDaeguIds(RECENT_TITLES_FOR_DEDUP);
    const recentTitles = (await Promise.all(recentIds.map((rid) => getDaeguPost(rid))))
      .map((p) => p && p.title)
      .filter(Boolean);

    const today = todayKst();
    let post = null;
    let fresh = null;
    const skips = [];

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      // 시간 예산 — maxDuration(300s)에 걸려 504로 죽는 대신 우아하게 종료
      if (Date.now() - t0 > 200000) {
        skips.push("시간 예산 초과로 중단");
        break;
      }
      // 매 시도마다 재계산 — 직전 시도에서 소진된 링크를 반영
      const unseenLinks = new Set(await filterUnseenLinks(all.map((c) => c.link)));
      // 소스별 균형 선발 — daegu-candidates.js와 같은 규칙(최신순 절단이 블로그·공식을 배제했던 것 수정)
      fresh = pickBalancedCandidates(
        all.filter((c) => unseenLinks.has(c.link)),
        MAX_CANDIDATES_TO_AI
      );
      if (!fresh.length) {
        return res.status(200).json({ ok: true, skipped: "새 소재 없음(전부 사용됨)", attempts: skips });
      }

      const draft = await aiWriteDaeguPost({ candidates: fresh, today, recentTitles });
      if (!draft || draft.error) {
        // 일시 오류(파싱 실패·레이트리밋 등)일 수 있음 — 회차를 죽이지 않고 재시도
        skips.push(`AI 작성 실패: ${draft?.error || "null 반환"}`);
        continue;
      }
      if (draft.skip) {
        return res.status(200).json({ ok: true, skipped: `작성 스킵: ${draft.reason}`, attempts: skips });
      }

      // 중복·근거·검수 판정은 공통 로직 — 막히면 소재는 이미 소진돼 있으므로 바로 재시도
      const review = await aiReviewDaeguPost({ post: draft, candidates: fresh, today });
      const verdict = await validateDraft({ draft, fresh, recentTitles, review, today });
      if (!verdict.ok) {
        skips.push(verdict.reason);
        continue;
      }

      post = draft;
      break;
    }

    if (!post) {
      return res.status(200).json({
        ok: true,
        skipped: `${MAX_ATTEMPTS}회 시도 모두 차단`,
        attempts: skips,
        timings: { ...timings, total: Date.now() - t0 },
      });
    }

    // 4~5) 이미지 확보 → 저장 → 소재 소진 → 목록 재검증 → IndexNow
    const saved = await finalizePost({ post, fresh, all, today, aiModel: "gpt-4o-mini", res });

    return res.status(200).json({
      ok: true,
      id: saved.id,
      isNew: saved.isNew,
      title: post.title,
      candidates: all.length,
      sourceMix,
      fresh: fresh.length,
      used: post.used_links.length,
      indexnow: saved.indexnow,
      timings: { ...timings, total: Date.now() - t0 },
      ...(skips.length ? { retried: skips } : {}),
    });
  } catch (e) {
    console.error("daegu-post cron error:", e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
