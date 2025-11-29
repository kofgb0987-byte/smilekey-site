// pages/api/telegram-webhook.js
import { appendMessage } from "../../lib/redis";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({ ok: true });
  }

  const update = req.body;
  console.log("TG UPDATE:", JSON.stringify(update));

  const message = update.message;
  if (!message) {
    console.log("TG: no message, ignore");
    return res.status(200).json({ ok: true });
  }

  const reply = message.reply_to_message;
  if (!reply || !reply.text) {
    console.log("TG: not a reply, ignore");
    return res.status(200).json({ ok: true });
  }

  // 원본 텍스트에서 [CID:...] 뽑기
  const cidMatch = reply.text.match(/\[CID:([^\]\n]+)\]/);
  if (!cidMatch) {
    console.log("TG: CID not found in:", reply.text);
    return res.status(200).json({ ok: true });
  }

  const conversationId = cidMatch[1];
  const adminText = (message.text || "").trim();
  if (!adminText) {
    console.log("TG: empty admin text, ignore");
    return res.status(200).json({ ok: true });
  }

  const msgObj = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    from: "admin",
    text: adminText,
    createdAt: new Date().toISOString(),
  };

  try {
    console.log("TG: append admin message to", conversationId, "=>", adminText);
    await appendMessage(conversationId, msgObj);
  } catch (e) {
    console.error("TG: appendMessage error:", e);
  }

  return res.status(200).json({ ok: true });
}
