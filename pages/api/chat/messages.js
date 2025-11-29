// pages/api/chat/messages.js
import { getMessages } from "../../../lib/redis";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  // 캐시 완전 비활성화
  res.setHeader("Cache-Control", "no-store, max-age=0");

  const { conversationId } = req.query;

  if (!conversationId) {
    return res
      .status(400)
      .json({ ok: false, error: "conversationId is required" });
  }

  try {
    const messages = await getMessages(conversationId, 100);
  console.log("API /chat/messages ->", conversationId, "len =", messages.length);
    return res.status(200).json({ ok: true, messages });
  } catch (e) {
    console.error("chat/messages error:", e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
