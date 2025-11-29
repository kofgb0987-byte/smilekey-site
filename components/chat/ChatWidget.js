// components/chat/ChatWidget.js.js
import { useState } from "react";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null); // "success" | "error" | null

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    setSending(true);
    setStatus(null);

    try {
      const res = await fetch("/api/telegram", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });

      if (!res.ok) throw new Error("request failed");

      setStatus("success");
      setMessage("");
    } catch (err) {
      console.error(err);
      setStatus("error");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* 열기/닫기 버튼 */}
      <button
        type="button"
        className="chat-toggle-button"
        onClick={() => setOpen((v) => !v)}
      >
        💬
      </button>

      {open && (
        <div className="chat-window">
          <div className="chat-window-header">
            <div className="chat-window-title">실시간 문의</div>
            <div className="chat-window-subtitle">
              텔레그램으로 바로 전달되어 답변 드립니다.
            </div>
          </div>

          <form className="chat-form" onSubmit={handleSubmit}>
            <textarea
              className="chat-textarea"
              placeholder={
                "예) 이름, 연락처와 함께\n차량 종류/연식, 키 상태(분실/예비키/폴딩키) 등을 적어 주세요."
              }
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />

            {status === "success" && (
              <div className="chat-status chat-status--success">
                문의가 전송되었습니다. 가능한 빠르게 답변 드릴게요.
              </div>
            )}
            {status === "error" && (
              <div className="chat-status chat-status--error">
                전송 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.
              </div>
            )}

            <button
              type="submit"
              className="chat-submit-button"
              disabled={sending}
            >
              {sending ? "전송 중..." : "문의 보내기"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
