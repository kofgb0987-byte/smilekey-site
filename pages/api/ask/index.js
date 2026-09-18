// pages/api/ask/index.js — 상담 질문 접수
//   POST { question, phone?, page?, website?(허니팟) } → 큐 적재 → { ok, id }
//   답변은 집 PC의 scripts/ask-worker.mjs 가 만들어 smilekey:ask:answer:<id> 에 넣고, 화면은 /api/ask/answer 로 폴링한다.
//   집 PC가 꺼져 있으면 답이 안 오지만 접수는 성공 처리 — 위젯이 시간 초과 시 전화 안내로 넘긴다.
import crypto from "crypto";
import { redis, rateLimitOk } from "../../../lib/redis";

const QUEUE = "smilekey:ask:queue";
const clean = (s, max) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });
  const body = req.body || {};
  if (body.website) return res.status(200).json({ ok: true, id: "" }); // 봇 허니팟: 성공한 척

  const question = String(body.question ?? "").trim().slice(0, 1000);
  if (question.length < 5) return res.status(400).json({ ok: false, error: "too short" });
  const phone = clean(body.phone, 20).replace(/[^\d+-]/g, "");
  const page = clean(body.page, 200);
  const ua = clean(req.headers["user-agent"], 120);
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();
  const ipHash = crypto.createHash("sha1").update(ip).digest("hex").slice(0, 12);

  try {
    // 구독 한도를 같이 쓰는 워커라 남용 방어가 곧 비용 방어다: IP당 시간 6건, 전체 하루 300건
    if (!(await rateLimitOk("ask", ipHash, { limit: 6, windowSec: 3600 }))) return res.status(429).json({ ok: false, error: "rate" });
    if (!(await rateLimitOk("ask-day", "all", { limit: 300, windowSec: 86400 }))) return res.status(429).json({ ok: false, error: "busy" });

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const record = { id, at: new Date().toISOString(), question, phone, page, ua, ipHash };
    await redis.lpush(QUEUE, JSON.stringify(record));
    return res.status(200).json({ ok: true, id });
  } catch (e) {
    console.error("ask enqueue error:", e);
    return res.status(500).json({ ok: false, error: "server" });
  }
}
