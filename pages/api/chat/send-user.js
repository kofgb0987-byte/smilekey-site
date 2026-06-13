// pages/api/chat/send-user.js
import { appendMessage, getMessages } from "../../../lib/redis";

const PHONE = "010-3503-6919";

const AUTO_REPLIES = [
  `안녕하세요, 중앙열쇠입니다 😊\n\n어떤 상황이신가요?\n\n예) 차키 분실 / 예비키 제작 / 폴딩키 / 도어락 교체 / 수입차 스마트키`,
  `차종과 연식, 현재 계신 위치를 함께 알려주시면\n정확하게 안내해드릴 수 있어요!`,
  `감사합니다! 정확한 비용과 가능 여부는\n전화로 바로 확인하실 수 있습니다.\n\n📞 ${PHONE}\n\n전화 주시면 바로 안내해드릴게요 😊`,
];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  const { conversationId, message } = req.body || {};
  if (!conversationId || !message) {
    return res.status(400).json({ ok: false, error: "conversationId and message required" });
  }

  try {
    // 유저 메시지 저장
    await appendMessage(conversationId, {
      id: Date.now().toString(),
      from: "user",
      text: message,
      createdAt: new Date().toISOString(),
    });

    // 메시지 현황 파악
    const allMessages = await getMessages(conversationId, 100);
    const userMsgCount = allMessages.filter((m) => m?.from === "user").length;
    const hasManualAdminReply = allMessages.some((m) => m?.from === "admin" && !m?.auto);

    // 자동답변: 수동 답변이 없고 첫 3번째 메시지까지만
    if (!hasManualAdminReply && userMsgCount >= 1 && userMsgCount <= AUTO_REPLIES.length) {
      await appendMessage(conversationId, {
        id: (Date.now() + 1).toString(),
        from: "admin",
        text: AUTO_REPLIES[userMsgCount - 1],
        createdAt: new Date().toISOString(),
        auto: true,
      });
    }

    // 텔레그램 전송 (수동 답변용)
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (botToken && chatId) {
      const shortId = conversationId.slice(0, 6).toUpperCase();
      const text = [
        `[CID:${conversationId}]`,
        `상담번호: ${shortId}`,
        "",
        message,
        "",
        '👉 이 메시지에 "답장"으로 회신해 주세요.',
      ].join("\n");

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("send-user error:", e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
