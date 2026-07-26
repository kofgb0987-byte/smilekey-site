// pages/api/cron/export-redis.js — 로컬 Redis 이관용 일회성 내보내기 (이관 후 제거 예정)
// 호출: GET /api/cron/export-redis?cursor=0   Authorization: Bearer {CRON_SECRET}
// 응답: {cursor: 다음커서(0이면 끝), entries: [{key, type, value, ttl}]}
import { redis } from "../../../lib/redis";

export default async function handler(req, res) {
  const auth = req.headers.authorization || "";
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ ok: false });
  }

  const cursor = Number(req.query.cursor || 0);

  try {
    const [nextCursor, keys] = await redis.scan(cursor, { match: "smilekey:*", count: 50 });

    const entries = [];
    for (const key of keys) {
      const type = await redis.type(key);
      let value = null;
      if (type === "hash") value = await redis.hgetall(key);
      else if (type === "list") value = await redis.lrange(key, 0, -1);
      else if (type === "set") value = await redis.smembers(key);
      else if (type === "zset") value = await redis.zrange(key, 0, -1, { withScores: true });
      else if (type === "string") value = await redis.get(key);
      else continue;

      const ttl = await redis.ttl(key);
      entries.push({ key, type, value, ttl });
    }

    return res.status(200).json({ ok: true, cursor: Number(nextCursor), entries });
  } catch (e) {
    console.error("export-redis error:", e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
