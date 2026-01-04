// pages/api/summaries.js
import { listSummaryIds, saveSummary, getSummary, deleteSummary } from "../../lib/redis";

export default async function handler(req, res) {

if (req.method === "DELETE") {

    console.log("DELETE /api/summaries hit", req.query);

    try {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "Missing id" });

      await deleteSummary(id);
      return res.status(200).json({ ok: true, id });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Failed to delete summary" });
    }
  }

  if (req.method === "GET") {
  try {
    const { id } = req.query;

    // ✅ id 있으면 단건 조회
    if (id) {
      const it = await getSummary(id);
      if (!it) return res.status(404).json({ error: "Not found" });
      return res.status(200).json({ item: { ...it, id } });
    }

    // ✅ 없으면 기존 목록
    const ids = await listSummaryIds(50);
    const items = await Promise.all(
      ids.map(async (sid) => {
        const it = await getSummary(sid);
        return it ? { ...it, id: sid } : null;
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
