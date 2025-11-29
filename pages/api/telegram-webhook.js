// pages/api/telegram-webhook.js
import { appendMessage } from "../../lib/redis";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({ ok: true });
  }

  const body = req.body;
  const message = body.message;

  if (!message) return res.status(200).json({ ok: true });

  const adminChatId = Number(process.env.TELEGRAM_CHAT_ID);

  // 사장님 방에서 온 메시지만 처리
  if (message.chat.id !== adminChatId) {
    return res.status(200).json({ ok: true });
  }

  // reply 형태인지 확인
  const reply = message.reply_to_message;
  if (!reply || !reply.text) return res.status(200).json({ ok: true });

  // [CID:xxxx] 파싱
  const m = reply.text.match(/\[CID:([^\]]+)\]/);
  if (!m) return res.status(200).json({ ok: true });

  const conversationId = m[1];
  const adminText = message.text;

  const msgObj = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    from: "admin",
    text: adminText,
    createdAt: new Date().toISOString(),
  };

  // Redis 저장
  try {
    await appendMessage(conversationId, msgObj);
  } catch (e) {
    console.error("admin message save error:", e);
  }

  return res.status(200).json({ ok: true });
}
