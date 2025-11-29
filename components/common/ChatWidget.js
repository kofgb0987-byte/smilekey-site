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

  // 1) conversationId 초기화
  useEffect(() => {
    let cid =
      typeof window !== "undefined"
        ? window.localStorage.getItem("smilekey_cid")
        : null;

    if (!cid) {
      cid = createConversationId();
      if (typeof window !== "undefined") {
        window.localStorage.setItem("smilekey_cid", cid);
      }
    }
    setConversationId(cid);
  }, []);

  // 2) 메시지 가져오기
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

  // 3) 폴링 시작/중단
  useEffect(() => {
    if (!conversationId) return;

    fetchMessages(conversationId); // 처음 한 번

    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(() => {
      fetchMessages(conversationId);
    }, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [conversationId]);

  // 4) 메시지 변경 시 맨 아래로 스크롤
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, isOpen]);

  // 5) 메시지 보내기
  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || !conversationId || sending) return;

    setSending(true);

    try {
      // 낙관적 업데이트: 먼저 화면에 추가
      const myMsg = {
        id: Date.now().toString(),
        from: "user",
        text: trimmed,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, myMsg]);
      setInput("");

      const res = await fetch("/api/chat/send-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: trimmed }),
      });

      const data = await res.json();
      if (!data.ok) {
        console.error("send-user error:", data.error);
      } else {
        // 서버 기준으로 다시 싱크
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
      {/* 플로팅 버튼 */}
      <button
        type="button"
        className="chat-floating-button"
        onClick={() => setIsOpen(true)}
      >
        💬
      </button>

      {!isOpen ? null : (
        <div className="chat-modal-backdrop">
          <div className="chat-modal">
            {/* 헤더 */}
            <div className="chat-header">
              <div className="chat-header-title">실시간 문의</div>
              <button
                type="button"
                className="chat-header-close"
                onClick={() => setIsOpen(false)}
              >
                ✕
              </button>
            </div>

            {/* 안내문 */}
            <div className="chat-intro">
              아래 채팅창에 편하게 문의 남겨주세요.
              <br />
              <strong>
                차량 차종/연식, 연락처, 대략적인 위치를 함께 적어 주시면
              </strong>
              <br />
              가능 여부와 예상 비용을 보고 연락드릴게요.
            </div>

            {/* 안내 예시 말풍선 */}
            <div className="chat-bubble chat-bubble--admin">
              <div className="chat-bubble-text">
                안녕하세요, 중앙열쇠입니다 🙂{"\n\n"}
                차량 정보를 보내주시면 정확한 안내가 가능합니다.
                {"\n\n"}
                - 차종 / 연식
                {"\n"}
                - 연락처
                {"\n"}
                - 대략적인 위치
                {"\n\n"}
                예) 2018 그랜저IG / 010-1234-5678 / 동구 검사동 ○○아파트 주차장
              </div>
            </div>

            {/* 실제 대화 영역 */}
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

            {/* 입력창 + 보내기 버튼 */}
            <div className="chat-input-row">
              <textarea
                className="chat-input"
                placeholder="내용을 입력해주세요."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
              />
              <button
                type="button"
                className="chat-send-button"
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
