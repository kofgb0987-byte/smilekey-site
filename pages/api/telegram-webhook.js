// pages/api/telegram-webhook.js
import { appendMessage } from "../../lib/redis";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({ ok: true });
  }

  const update = req.body;
  const message = update.message;
  if (!message) {
    return res.status(200).json({ ok: true });
  }

  const reply = message.reply_to_message;
  if (!reply || !reply.text) {
    // Reply 아닌 메시지는 무시
    return res.status(200).json({ ok: true });
  }

  // 1) 원본 텍스트에서 [CID:...] 뽑기
  const cidMatch = reply.text.match(/\[CID:([^\]\n]+)\]/);
  if (!cidMatch) {
    console.log("TG: CID not found in:", reply.text);
    return res.status(200).json({ ok: true });
  }
  const conversationId = cidMatch[1];

  // 2) 사장님이 실제로 쓴 답장 텍스트
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

  console.log(
    "TG: append admin message to",
    conversationId,
    "=>",
    adminText
  );

  try {
    await appendMessage(conversationId, msgObj);
  } catch (e) {
    console.error("TG: appendMessage error:", e);
  }

  return res.status(200).json({ ok: true });
}
