// pages/api/chat/messages.js
import { getMessages } from "../../../lib/redis";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  const { conversationId } = req.query;

  if (!conversationId) {
    return res
      .status(400)
      .json({ ok: false, error: "conversationId is required" });
  }

  const messages = await getMessages(conversationId);

  return res.status(200).json({ ok: true, messages });
}
