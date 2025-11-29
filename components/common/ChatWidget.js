// components/common/ChatWidget.js
import { useEffect, useState } from "react";

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgInput, setMsgInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // 대화 ID 생성 (브라우저 전용)
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

  // 패널 열려 있을 때만 3초마다 메시지 폴링
  useEffect(() => {
    if (!isOpen || !conversationId) return;

    let timer;
    const fetchMessages = async () => {
      try {
        const res = await fetch(
          `/api/chat/messages?conversationId=${conversationId}`
        );
        const data = await res.json();
        if (data.ok && Array.isArray(data.messages)) {
          // 서버에 데이터가 있을 때만 덮어쓰기 (빈 배열이면 유지)
          if (data.messages.length > 0) {
            setMessages(data.messages);
          }
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

    // 내 메시지를 먼저 화면에 추가
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
            {/* 고정 안내 문구 (상단) */}
            <p className="chat-panel-desc">
              아래 채팅창에 편하게 문의 남겨주세요.
              <br />
              <strong>
                차량 차종/연식, 연락처, 대략적인 위치
              </strong>
              를 함께 적어주시면
              <br />
              가능한지와 예상 비용을 보고 연락드립니다.
            </p>

            {/* 실제 채팅창 */}
            <div className="chat-messages">
              {/* 상담사가 먼저 말 거는 버블 (로컬 전용, 서버에는 안 저장) */}
              <div className="chat-bubble chat-bubble--admin">
  <div className="chat-bubble-text" style={{ whiteSpace: "pre-line" }}>
    {`안녕하세요, 중앙열쇠입니다 🙂  

차량 정보를 보내주시면 정확한 안내가 가능합니다.

- 차종 / 연식  
- 연락처  
- 대략적인 위치  

예) 2018 그랜저IG / 010-1234-5678 / 동구 검사동 ○○아파트 주차장`}
  </div>
</div>

              {/* 서버에서 온 메시지들 */}
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

            {/* 입력 영역 */}
            {/* 입력 영역 */}
{error && <div className="chat-error">{error}</div>}

<form onSubmit={handleSubmit} className="chat-input-row">
  {/* (옵션) 왼쪽에 클립 아이콘 넣고 싶으면 주석 해제 */}
  {/* <button type="button" className="chat-icon-btn" disabled>
    📎
  </button> */}

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
