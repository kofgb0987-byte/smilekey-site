// pages/api/summaries.js
import { listSummaryIds, saveSummary,getSummary } from "../../lib/redis";

export default async function handler(req, res) {
  if (req.method === "GET") {
  try {
    const ids = await listSummaryIds(50);

    const items = await Promise.all(
      ids.map(async (id) => {
        const it = await getSummary(id);
        return it ? { ...it, id } : null;
      })
    );

    return res.status(200).json({ items: items.filter(Boolean) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to load summaries" });
  }
}

  if (req.method === "POST") {
    try {
      const item = req.body;

      // 최소 필드 체크
      if (!item?.id || !item?.title || !item?.link) {
        return res.status(400).json({ error: "Missing fields: id/title/link" });
      }

      await saveSummary(item);
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Failed to save summary" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
