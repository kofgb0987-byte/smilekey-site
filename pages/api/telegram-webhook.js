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

  // 우리 설정한 CHAT_ID가 맞는지 확인 (다른 방 메시지는 무시)
  const adminChatId = process.env.TELEGRAM_CHAT_ID;
  if (adminChatId && String(message.chat.id) !== String(adminChatId)) {
    return res.status(200).json({ ok: true });
  }

  // 반드시 "답장(Reply)"여야 함
  const reply = message.reply_to_message;
  if (!reply || !reply.text) {
    // reply가 아닌 일반 메시지는 무시
    return res.status(200).json({ ok: true });
  }

  // 원본 메시지 텍스트에서 [CID:...] 를 정규식으로 추출
  const cidMatch = reply.text.match(/\[CID:([^\]\n]+)\]/);
  if (!cidMatch) {
    // CID 못 찾으면 무시
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
    await appendMessage(conversationId, msgObj);
  } catch (e) {
    console.error("telegram-webhook appendMessage error:", e);
  }

  return res.status(200).json({ ok: true });
}
