// pages/api/redis-debug-conv.js
import { redis } from "../../lib/redis";

export default async function handler(req, res) {
  const { conversationId } = req.query;

  if (!conversationId) {
    return res
      .status(400)
      .json({ ok: false, error: "conversationId is required" });
  }

  const key = `chat:conv:${conversationId}`;

  try {
    const list = await redis.lrange(key, 0, -1);

    return res.status(200).json({
      ok: true,
      key,
      rawLength: list.length,
      raw: list,
    });
  } catch (e) {
    console.error("redis-debug-conv error:", e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
