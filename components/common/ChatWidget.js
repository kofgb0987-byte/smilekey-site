// components/common/ChatWidget.js
import { useEffect, useRef, useState } from "react";

function createConversationId() {
  return (
    Date.now().toString(16) +
    "-" +
    Math.random().toString(16).slice(2) +
    "-" +
    crypto.randomUUID().slice(0, 8)
  );
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const pollingRef = useRef(null);
  const bottomRef = useRef(null);

  // conversationId 초기화 (24시간 지나면 새 대화)
  useEffect(() => {
    const CID_KEY = "smilekey_cid";
    const TS_KEY = "smilekey_cid_ts";
    const TTL_MS = 24 * 60 * 60 * 1000;

    const stored = localStorage.getItem(CID_KEY);
    const ts = parseInt(localStorage.getItem(TS_KEY) || "0", 10);
    const expired = Date.now() - ts > TTL_MS;

    let cid = stored && !expired ? stored : null;
    if (!cid) {
      cid = createConversationId();
      localStorage.setItem(CID_KEY, cid);
      localStorage.setItem(TS_KEY, Date.now().toString());
    }
    setConversationId(cid);
  }, []);

  async function fetchMessages(cid) {
    try {
      const res = await fetch(
        `/api/chat/messages?conversationId=${encodeURIComponent(cid)}`
      );
      const data = await res.json();
      if (data.ok && Array.isArray(data.messages)) {
        setMessages(data.messages);
      }
    } catch (e) {
      console.error("fetchMessages error:", e);
    }
  }

  // 채팅창이 열려있을 때만 폴링
  useEffect(() => {
    if (!conversationId || !isOpen) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }

    fetchMessages(conversationId);

    pollingRef.current = setInterval(() => {
      fetchMessages(conversationId);
    }, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [conversationId, isOpen]);

  // 메시지 변경 시 맨 아래로 스크롤
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, isOpen]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || !conversationId || sending) return;

    setSending(true);

    try {
      const myMsg = {
        id: Date.now().toString(),
        from: "user",
        text: trimmed,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, myMsg]);
      setInput("");

      localStorage.setItem("smilekey_cid_ts", Date.now().toString());

      const res = await fetch("/api/chat/send-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: trimmed }),
      });

      const data = await res.json();
      if (!data.ok) {
        console.error("send-user error:", data.error);
      } else {
        fetchMessages(conversationId);
      }
    } catch (e) {
      console.error("handleSend error:", e);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      <button
        type="button"
        className="chat-floating-button"
        aria-label="채팅 문의 열기"
        onClick={() => setIsOpen(true)}
      >
        💬
      </button>

      {!isOpen ? null : (
        <div className="chat-modal-backdrop" onClick={() => setIsOpen(false)}>
          <div className="chat-modal" onClick={(e) => e.stopPropagation()}>
            <div className="chat-header">
              <div className="chat-header-title">실시간 문의</div>
              <button
                type="button"
                className="chat-header-close"
                aria-label="채팅 닫기"
                onClick={() => setIsOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="chat-intro">
              차키 분실 · 예비키 · 스마트키 · 도어락 문의를 남겨주세요.
              <br />
              확인 후 빠르게 안내드립니다.
            </div>

            <div className="chat-messages">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={
                    m.from === "admin"
                      ? "chat-bubble chat-bubble--admin"
                      : "chat-bubble chat-bubble--user"
                  }
                >
                  <div className="chat-bubble-text">{m.text}</div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="chat-input-row">
              <textarea
                className="chat-input"
                placeholder="문의 내용을 입력해주세요."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
              />
              <button
                type="button"
                className="chat-send-button"
                aria-label="메시지 보내기"
                onClick={handleSend}
                disabled={sending || !input.trim()}
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
