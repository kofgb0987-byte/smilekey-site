// pages/api/summary/[id].js
import { getSummary } from "../../../lib/redis";

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const item = await getSummary(id);
    if (!item) return res.status(404).json({ error: "Not found" });
    return res.status(200).json({ item });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to load summary" });
  }
}
