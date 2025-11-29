// pages/api/chat/send-user.js

import { appendMessage } from "../../../lib/redis";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });

  const { conversationId, carInfo, phone, location, message } = req.body || {};

  if (!conversationId)
    return res.status(400).json({ ok: false, error: "conversationId required" });

  try {
    // 1) Redis 저장
    await appendMessage(conversationId, {
      id: Date.now().toString(),
      from: "user",
      text: message,
      carInfo,
      phone,
      location,
      createdAt: new Date().toISOString(),
    });

    // 2) Telegram 발송
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (botToken && chatId) {
      const lines = [
        `[CID:${conversationId}]`,
        "",
        "📩 새 웹 문의가 도착했습니다.",
        "",
      ];

      if (carInfo) lines.push(`차종/연식: ${carInfo}`);
      if (phone) lines.push(`연락처: ${phone}`);
      if (location) lines.push(`위치: ${location}`);
      lines.push("");
      lines.push("문의 내용:");
      lines.push(message);

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
