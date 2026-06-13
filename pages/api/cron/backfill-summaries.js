// pages/api/cron/backfill-summaries.js
// summary_en/zh 없는 기존 항목에 AI 요약 채우기
// 호출: POST /api/cron/backfill-summaries?batch=10
//        Authorization: Bearer {CRON_SECRET}

import { listSummaryIds, getSummary, saveSummary } from "../../../lib/redis";
import { aiSummarize3 } from "../../../lib/ai";

export default async function handler(req, res) {
  const auth = req.headers.authorization || "";
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const batchSize = Math.min(parseInt(req.query.batch || "5"), 20);

  const ids = await listSummaryIds(200);

  let processed = 0;
  let alreadyDone = 0;
  const results = [];

  for (const id of ids) {
    if (processed >= batchSize) break;

    const item = await getSummary(id);
    if (!item) continue;

    // 이미 영어/중국어 있으면 스킵
    if (item.summary_en && item.summary_zh) {
      alreadyDone++;
      continue;
    }

    const tri = await aiSummarize3({
      title: item.title || "",
      baseSummary: item.summary_base || item.summary || item.title || "",
      bodyText: item.bodyText || "",
      source: item.source || "",
      date: item.date || "",
    });

    if (tri?.ko) {
      await saveSummary({
        id,
        summary: tri.ko,
        summary_ko: tri.ko,
        summary_en: tri.en || "",
        summary_zh: tri.zh || "",
        ai_model: "gpt-4o-mini",
        ai_at: new Date().toISOString(),
      });

      results.push({
        id,
        title: item.title,
        source: item.source,
        ko: tri.ko,
        en: tri.en,
        zh: tri.zh,
      });
    }

    processed++;
  }

  return res.status(200).json({
    ok: true,
    processed,
    alreadyDone,
    remaining: ids.length - alreadyDone - processed,
    total: ids.length,
    results,
  });
}
