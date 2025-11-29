// components/common/ChatWidget.js
import { useEffect, useState } from "react";

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgInput, setMsgInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // 브라우저에서만 conversationId 생성/저장
  useEffect(() => {
    if (typeof window === "undefined") return;

    let cid = window.localStorage.getItem("conversationId");
    if (!cid) {
      cid =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : Date.now().toString(36);
      window.localStorage.setItem("conversationId", cid);
    }
    setConversationId(cid);
  }, []);

  // 채팅창 열려있을 때만 3초마다 메시지 폴링
  useEffect(() => {
    if (!isOpen || !conversationId) return;

    let timer;
    const fetchMessages = async () => {
      try {
        const res = await fetch(
          `/api/chat/messages?conversationId=${encodeURIComponent(
            conversationId
          )}&t=${Date.now()}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (data.ok && Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
      } catch (e) {
        console.error("fetch messages error:", e);
      } finally {
        timer = setTimeout(fetchMessages, 3000);
      }
    };

    fetchMessages();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isOpen, conversationId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const text = msgInput.trim();
    if (!text || !conversationId || sending) return;

    setSending(true);
    setError("");
    setMsgInput("");

    // 내 메시지를 먼저 화면에 추가 (낙관적 업데이트)
    const localMsg = {
      id: `${Date.now()}-local`,
      from: "user",
      text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, localMsg]);

    try {
      await fetch("/api/chat/send-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          message: text,
        }),
      });
    } catch (e) {
      console.error(e);
      setError("전송 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* 오른쪽 아래 플로팅 버튼 */}
      <button
        type="button"
        className="chat-toggle-btn"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        💬
      </button>

      {isOpen && (
        <div className="chat-panel">
          <div className="chat-panel-header">
            <div className="chat-panel-title">실시간 문의</div>
            <button
              type="button"
              className="chat-panel-close"
              onClick={() => setIsOpen(false)}
            >
              ✕
            </button>
          </div>

          <div className="chat-panel-body">
            {/* 상단 안내 문구 */}
            <p className="chat-panel-desc">
              아래 채팅창에 편하게 문의 남겨주세요.{" "}
              <br />
              <strong>차량 차종/연식, 연락처, 대략적인 위치</strong>를 함께 적어
              주시면 가능한지와 예상 비용을 보고 연락드립니다.
            </p>

            {/* 채팅 내용 영역 */}
            <div className="chat-messages">
              {/* 상담사 첫 안내 말풍선 (로컬 전용) */}
              <div className="chat-bubble chat-bubble--admin">
                <div
                  className="chat-bubble-text"
                  style={{ whiteSpace: "pre-line" }}
                >
                  {`안녕하세요, 중앙열쇠입니다 🙂  

차량 정보를 보내주시면 정확한 안내가 가능합니다.

- 차종 / 연식
- 연락처
- 대략적인 위치

예) 2018 그랜저IG / 010-1234-5678 / 동구 검사동 ○○아파트 주차장`}
                </div>
              </div>

              {/* 실제 대화 메시지들 */}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={
                    "chat-bubble " +
                    (m.from === "admin"
                      ? "chat-bubble--admin"
                      : "chat-bubble--user")
                  }
                >
                  <div className="chat-bubble-text">{m.text}</div>
                </div>
              ))}
            </div>

            {/* 에러 메시지 */}
            {error && <div className="chat-error">{error}</div>}

            {/* 입력 라인 (왼쪽 입력창 + 오른쪽 보내기 버튼) */}
            <form onSubmit={handleSubmit} className="chat-input-row">
              <textarea
                rows={1}
                className="chat-input"
                value={msgInput}
                onChange={(e) => setMsgInput(e.target.value)}
                placeholder="내용을 입력해주세요."
              />

              <button
                type="submit"
                className="chat-send-btn"
                disabled={sending}
              >
                ➤
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
