// pages/api/cron/daegu-save.js — 대구 소식 초안 검증·저장 (로컬 작성기용)
// 호출: POST /api/cron/daegu-save
//       Authorization: Bearer {CRON_SECRET}
//       body: { batch, draft, reviewRaw, aiModel }
//         batch     — daegu-candidates가 돌려준 회차 토큰
//         draft     — {title, hook, sections, tags, used_links}
//         reviewRaw — 팩트체커 모델의 원본 JSON(판정은 여기서 코드가 한다)
//         aiModel   — 기록용 모델명
//
// 응답: 200 {ok, published:true, id, title}      — 발행됨
//       200 {ok, published:false, reason}        — 차단됨(소재는 소진 처리됨, 재시도 가능)
//       410 {ok:false, error}                    — 배치 만료(수집부터 다시)

import { validateDraft, finalizePost, loadBatch } from "../../../lib/daegu-core";
import { normalizeDraft, judgeReview } from "../../../lib/daegu-prompts.mjs";

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const auth = req.headers.authorization || "";
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const batch = await loadBatch(String(body.batch || ""));
    if (!batch) {
      return res.status(410).json({ ok: false, error: "배치 만료 또는 없음 — daegu-candidates부터 다시" });
    }

    const draft = normalizeDraft(body.draft);
    if (draft.error) return res.status(400).json({ ok: false, error: draft.error });
    if (draft.skip) return res.status(200).json({ ok: true, published: false, skipped: true, reason: draft.reason });

    const { all, fresh, recentTitles, today } = batch;
    const review = judgeReview(body.reviewRaw || null, today);

    const verdict = await validateDraft({ draft, fresh, recentTitles, review, today });
    if (!verdict.ok) {
      return res.status(200).json({ ok: true, published: false, reason: verdict.reason });
    }

    const saved = await finalizePost({
      post: draft,
      fresh,
      all,
      today,
      aiModel: String(body.aiModel || "unknown"),
      res,
    });

    return res.status(200).json({
      ok: true,
      published: true,
      id: saved.id,
      isNew: saved.isNew,
      title: draft.title,
      used: draft.used_links.length,
      indexnow: saved.indexnow,
    });
  } catch (e) {
    console.error("daegu-save error:", e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
