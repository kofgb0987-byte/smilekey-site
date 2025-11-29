// pages/api/chat/send-user.js
import { appendMessage } from "../../../lib/redis";


export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  const { conversationId, name, phone, message } = req.body || {};

  if (!conversationId || !message) {
    return res
      .status(400)
      .json({ ok: false, error: "conversationId and message are required" });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const now = new Date().toISOString();
  const msgObj = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    from: "user",
    text: message,
    createdAt: now,
  };

  // (1) Redis 저장
  await appendMessage(conversationId, msgObj);

  // (2) 텔레그램으로 보내는 메시지
  const lines = [
    `[CID:${conversationId}]`,
    "",
    "📩 새 웹 문의가 도착했습니다.",
    "",
  ];

  if (name) lines.push(`이름: ${name}`);
  if (phone) lines.push(`전화: ${phone}`);
  if (name || phone) lines.push("");

  lines.push("내용:");
  lines.push(message);

  const text = lines.join("\n");

  // 텔레그램 전송
  try {
    await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
        }),
      }
    );

    return res.status(200).json({ ok: true, message: msgObj });
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ ok: false, error: "Telegram send error" });
  }
}
