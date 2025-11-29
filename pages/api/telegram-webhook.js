// pages/api/telegram-webhook.js
import { appendMessage } from "../../lib/redis";
import { redis } from "../../lib/redis";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({ ok: true });
  }

  const body = req.body;
  const message = body.message;
  if (!message) return res.status(200).json({ ok: true });

  const adminChatId = Number(process.env.TELEGRAM_CHAT_ID || "0");
  if (message.chat.id !== adminChatId) {
    // 다른 방이면 무시
    return res.status(200).json({ ok: true });
  }

  const reply = message.reply_to_message;
  if (!reply) {
    // Reply가 아닌 일반 메세지는 무시
    return res.status(200).json({ ok: true });
  }

  const repliedMsgId = reply.message_id;

  // 🔥 이 message_id에서 conversationId를 찾는다
  const conversationId = await redis.get(`chat:tgmsg:${repliedMsgId}`);
  if (!conversationId) {
    // 매핑 없으면 무시
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
