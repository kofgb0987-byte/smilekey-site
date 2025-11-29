// pages/api/redis-debug.js
import { redis } from "../../lib/redis";

export default async function handler(req, res) {
  try {
    const now = new Date().toISOString();
    await redis.rpush("chat:test:key", `hello ${now}`);
    const list = await redis.lrange("chat:test:key", 0, -1);

    res.status(200).json({
      ok: true,
      count: list.length,
      list,
    });
  } catch (e) {
    console.error("redis-debug error:", e);
    res.status(500).json({ ok: false, error: String(e) });
  }
}
