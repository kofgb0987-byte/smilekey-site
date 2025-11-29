// pages/api/telegram-webhook.js
import { appendMessage } from "../../lib/redis";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    // 텔레그램은 200만 받으면 됨
    return res.status(200).json({ ok: true });
  }

  const update = req.body;
  const message = update.message;
  if (!message) {
    return res.status(200).json({ ok: true });
  }

  // 우리 BOT이랑 대화중인 그 채팅방인지 확인
  const adminChatId = process.env.TELEGRAM_CHAT_ID;
  if (adminChatId && String(message.chat.id) !== String(adminChatId)) {
    return res.status(200).json({ ok: true });
  }

  // 반드시 "답장(Reply)" 형태여야 함
  const reply = message.reply_to_message;
  if (!reply || !reply.text) {
    // 그냥 새 메시지면 무시
    console.log("telegram-webhook: no reply_to_message, ignore");
    return res.status(200).json({ ok: true });
  }

  // 원본 메시지 텍스트에서 [CID:...] 추출
  const cidMatch = reply.text.match(/\[CID:([^\]\n]+)\]/);
  if (!cidMatch) {
    console.log("telegram-webhook: CID not found in text:", reply.text);
    return res.status(200).json({ ok: true });
  }
  const conversationId = cidMatch[1];

  const adminText = (message.text || "").trim();
  if (!adminText) {
    return res.status(200).json({ ok: true });
  }

  const msgObj = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    from: "admin",
    text: adminText,
    createdAt: new Date().toISOString(),
  };

  try {
    console.log("telegram-webhook: append admin message to", conversationId);
    await appendMessage(conversationId, msgObj);
  } catch (e) {
    console.error("telegram-webhook appendMessage error:", e);
  }

  return res.status(200).json({ ok: true });
}
