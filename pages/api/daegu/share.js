// pages/api/daegu/share.js — 공유 횟수 집계 (POST ?id=...)
import { incrDaeguShare, getDaeguPost, rateLimitOk } from "../../../lib/redis";

function clientIp(req) {
  return (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "unknown";
}

export default async function handler(req, res) {
  const { id } = req.query;
  if (req.method !== "POST" || !id || !/^[a-f0-9]{40}$/.test(id)) {
    return res.status(400).json({ ok: false });
  }

  try {
    if (!(await rateLimitOk("share", clientIp(req), { limit: 20, windowSec: 600 }))) {
      return res.status(429).json({ ok: false });
    }
    const post = await getDaeguPost(id);
    if (!post || !post.title) return res.status(404).json({ ok: false });

    const shares = await incrDaeguShare(id);
    return res.status(200).json({ ok: true, shares });
  } catch (e) {
    console.error("daegu share error:", e);
    return res.status(500).json({ ok: false });
  }
}
