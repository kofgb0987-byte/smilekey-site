// pages/api/daegu/comments.js — 익명 댓글
//   GET    ?id=... : 최신 50개 + 총 개수
//   POST   ?id=... body {name?, text, website?} : 등록 (website는 봇 함정 — 채워져 있으면 무시)
//   DELETE ?id=...&cid=... : 삭제 (Authorization: Bearer CRON_SECRET — 운영자 전용)
import {
  addDaeguComment,
  listDaeguComments,
  deleteDaeguComment,
  getDaeguPost,
  rateLimitOk,
} from "../../../lib/redis";

function clientIp(req) {
  return (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "unknown";
}

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id || !/^[a-f0-9]{40}$/.test(id)) {
    return res.status(400).json({ ok: false, error: "invalid id" });
  }

  try {
    if (req.method === "GET") {
      const { items, total } = await listDaeguComments(id, 50);
      return res.status(200).json({ ok: true, items, total });
    }

    if (req.method === "POST") {
      const { name, text, website } = req.body || {};
      // 봇 함정: 사람에겐 안 보이는 필드가 채워져 오면 성공한 척 무시
      if (website) return res.status(200).json({ ok: true });

      const trimmed = String(text || "").trim();
      if (!trimmed) return res.status(400).json({ ok: false, error: "내용을 입력해 주세요" });
      if (trimmed.length > 500) return res.status(400).json({ ok: false, error: "500자 이내로 써주세요" });

      if (!(await rateLimitOk("cmt", clientIp(req), { limit: 5, windowSec: 600 }))) {
        return res.status(429).json({ ok: false, error: "잠시 후 다시 시도해 주세요" });
      }

      const post = await getDaeguPost(id);
      if (!post || !post.title) return res.status(404).json({ ok: false });

      const comment = await addDaeguComment(id, { name, text: trimmed });
      return res.status(200).json({ ok: true, comment });
    }

    if (req.method === "DELETE") {
      const auth = req.headers.authorization || "";
      if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ ok: false });
      }
      const { cid } = req.query;
      if (!cid) return res.status(400).json({ ok: false, error: "cid 필요" });
      const removed = await deleteDaeguComment(id, cid);
      return res.status(removed ? 200 : 404).json({ ok: removed });
    }

    return res.status(405).json({ ok: false });
  } catch (e) {
    console.error("daegu comments error:", e);
    return res.status(500).json({ ok: false });
  }
}
