// pages/api/daegu/like.js — 좋아요
//   POST ?id=...  body {action: "like"|"unlike"} : 증감 후 현재 수 반환
//   GET  ?id=... : 현재 수만 반환
import { incrDaeguLike, getDaeguLike, getDaeguPost, rateLimitOk } from "../../../lib/redis";

function clientIp(req) {
  return (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "unknown";
}

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id || !/^[a-f0-9]{40}$/.test(id)) {
    return res.status(400).json({ ok: false, error: "invalid id" });
  }

  try {
    if (req.method === "POST") {
      if (!(await rateLimitOk("like", clientIp(req), { limit: 30, windowSec: 600 }))) {
        return res.status(429).json({ ok: false, error: "잠시 후 다시 시도해 주세요" });
      }
      const post = await getDaeguPost(id);
      if (!post || !post.title) return res.status(404).json({ ok: false });

      const action = req.body?.action === "unlike" ? "unlike" : "like";
      const likes = await incrDaeguLike(id, action === "unlike" ? -1 : 1);
      return res.status(200).json({ ok: true, likes });
    }
    return res.status(200).json({ ok: true, likes: await getDaeguLike(id) });
  } catch (e) {
    console.error("daegu like error:", e);
    return res.status(500).json({ ok: false });
  }
}
