// pages/api/telegram-webhook.js
import { appendMessage, redis } from "../../lib/redis";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({ ok: true });
  }

  const body = req.body;
  const message = body.message;
  if (!message) return res.status(200).json({ ok: true });

  const adminChatId = Number(process.env.TELEGRAM_CHAT_ID || "0");
  if (message.chat.id !== adminChatId) {
    return res.status(200).json({ ok: true });
  }

  const reply = message.reply_to_message;
  if (!reply) {
    // Reply가 아닌 메세지면 무시
    return res.status(200).json({ ok: true });
  }

  const repliedMsgId = reply.message_id;

  const conversationId = await redis.get(`chat:tgmsg:${repliedMsgId}`);
  if (!conversationId) {
    return res.status(200).json({ ok: true });
  }

  const adminText = message.text || "";
  const msgObj = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    from: "admin",
    text: adminText,
    createdAt: new Date().toISOString(),
  };

  try {
    await appendMessage(conversationId, msgObj);
  } catch (e) {
    console.error("admin message save error:", e);
  }

  return res.status(200).json({ ok: true });
}
