// pages/api/chat/send-user.js
import { appendMessage } from "../../../lib/redis";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  const { conversationId, message } = req.body || {};

  if (!conversationId || !message) {
    return res
      .status(400)
      .json({ ok: false, error: "conversationId and message required" });
  }

  try {
    // 1) 유저 메시지 Redis 저장
    await appendMessage(conversationId, {
      id: Date.now().toString(),
      from: "user",
      text: message,
      createdAt: new Date().toISOString(),
    });

    // 2) 텔레그램으로 전달
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (botToken && chatId) {
      const shortId = conversationId.slice(0, 6).toUpperCase();

      const lines = [
        `[CID:${conversationId}]`,
        `상담번호: ${shortId}`,
        "",
        message,
        "",
        '👉 이 메시지에 "답장"으로 회신해 주세요.',
      ];

      const text = lines.join("\n");

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
        }),
      });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("send-user error:", e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
