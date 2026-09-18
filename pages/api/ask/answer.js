// pages/api/ask/answer.js — 답변 폴링
//   GET ?id=<질문 id> → { status: "pending" } | { status: "ready", reply, link }
//   답변은 scripts/ask-worker.mjs 가 smilekey:ask:answer:<id> 에 JSON 문자열로 저장(48시간 만료).
import { redis } from "../../../lib/redis";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const id = String(req.query.id || "");
  if (!/^\d{10,16}-[a-z0-9]{4,10}$/i.test(id)) return res.status(200).json({ status: "pending" });
  try {
    const raw = await redis.get(`smilekey:ask:answer:${id}`);
    if (!raw) return res.status(200).json({ status: "pending" });
    const d = typeof raw === "string" ? JSON.parse(raw) : raw; // upstash 클라이언트는 JSON 문자열을 자동 파싱하기도 한다
    return res.status(200).json({ status: "ready", reply: d.reply || "", link: d.link || "" });
  } catch {
    return res.status(200).json({ status: "pending" });
  }
}
