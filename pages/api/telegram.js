// pages/api/telegram.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  const { name, phone, message } = req.body || {};

  if (!message) {
    return res
      .status(400)
      .json({ ok: false, error: "message is required" });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.error("Telegram env missing");
    return res
      .status(500)
      .json({ ok: false, error: "Telegram is not configured" });
  }

  // 여기서 파싱은 안 하고, 그냥 깔끔하게만 포맷팅
  const lines = ["📩 새 웹 문의가 도착했습니다.", ""];

  if (name) lines.push(`이름: ${name}`);
  if (phone) lines.push(`전화: ${phone}`);
  if (name || phone) lines.push(""); // 한 줄 띄우기

  lines.push("내용:");
  lines.push(message);

  const text = lines.join("\n");

  try {
    const telegramRes = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
        }),
      }
    );

    const data = await telegramRes.json();

    if (!data.ok) {
      console.error("Telegram API error:", data);
      return res
        .status(500)
        .json({ ok: false, error: "Failed to send to Telegram" });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Telegram fetch error:", e);
    return res
      .status(500)
      .json({ ok: false, error: "Telegram request failed" });
  }
}
