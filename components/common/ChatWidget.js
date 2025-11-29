// components/common/ChatWidget.js
import { useState, useEffect, useRef } from "react";

function createConversationId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return (
    Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8)
  );
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [msgInput, setMsgInput] = useState("");
  const [messages, setMessages] = useState([]);

  const messagesRef = useRef(null);

  // 대화 ID 생성
  useEffect(() => {
    let id = localStorage.getItem("conversationId");
    if (!id) {
      id = createConversationId();
      localStorage.setItem("conversationId", id);
    }
    setConversationId(id);
  }, []);

  // 메시지 폴링
  useEffect(() => {
    if (!conversationId) return;

    let timer;

    async function load() {
      try {
        const res = await fetch(
          `/api/chat/messages?conversationId=${conversationId}`
        );
        const data = await res.json();
        if (data.ok) setMessages(data.messages);
      } catch (e) {
        console.error(e);
      }

      timer = setTimeout(load, 3000);
    }

    load();

    return () => clearTimeout(timer);
  }, [conversationId]);

  // 스크롤 최신 메시지로 이동
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!msgInput.trim()) return;

    const text = msgInput.trim();
    setMsgInput("");

    // 내 메시지 낙관적 업데이트
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-local`,
        from: "user",
        text,
        createdAt: new Date().toISOString(),
      },
    ]);

    // 서버로 전송
    await fetch("/api/chat/send-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId,
        name,
        phone,
        message: text,
      }),
    });
  };

  return (
    <div>
      {/* floating button */}
      <button
        className="chat-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
      >
        💬
      </button>

      {isOpen && (
        <div className="chat-panel">
          <div className="chat-panel-header">
            <span>실시간 문의</span>
            <button
              className="chat-close"
              onClick={() => setIsOpen(false)}
            >
              ✕
            </button>
          </div>

          <div className="chat-panel-body">
            <p className="chat-desc">
              문의를 남기시면 사장님이 텔레그램으로 즉시 받고,
              <b>답장은 이 창에 다시 표시됩니다.</b>
            </p>

            <div className="chat-messages" ref={messagesRef}>
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`chat-bubble ${
                    m.from === "admin"
                      ? "chat-admin"
                      : "chat-user"
                  }`}
                >
                  {m.text}
                </div>
              ))}
            </div>

            <form onSubmit={sendMessage} className="chat-form">
              <input
                type="text"
                placeholder="이름 (선택)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                type="tel"
                placeholder="전화번호 (권장)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <textarea
                placeholder="문의 내용 입력"
                value={msgInput}
                onChange={(e) => setMsgInput(e.target.value)}
              />
              <button type="submit" className="chat-send-btn">
                보내기
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
