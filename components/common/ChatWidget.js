// components/common/ChatWidget.js
import { useEffect, useState } from "react";

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);

  const [carInfo, setCarInfo] = useState("");       // 차종/연식
  const [phone, setPhone] = useState("");           // 연락처
  const [locationText, setLocationText] = useState(""); // 위치
  const [msgInput, setMsgInput] = useState("");     // 문의 내용

  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // 대화 ID 생성 (브라우저 localStorage 사용)
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cid = window.localStorage.getItem("conversationId");
    if (!cid) {
      cid =
        (typeof crypto !== "undefined" && crypto.randomUUID)
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
        const res = await fetch(`/api/chat/messages?conversationId=${conversationId}`);
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
    if (!msgInput.trim() || !conversationId) return;

    setSending(true);
    setError("");

    const text = msgInput.trim();
    setMsgInput("");

    // 내 메시지 먼저 화면에 추가 (낙관적 업데이트)
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-local`,
        from: "user",
        text,
        createdAt: new Date().toISOString(),
      },
    ]);

    try {
      await fetch("/api/chat/send-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          carInfo,
          phone,
          location: locationText,
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
      {/* 오른쪽 아래 말풍선 버튼 */}
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
            <p className="chat-panel-desc">
              차종/연식, 연락처, 대략적인 위치를 남겨주시면<br />
              <strong>가능 여부와 예상 비용을 보고 빠르게 연락드릴게요.</strong>
            </p>

            {/* 메시지 영역 */}
            <div className="chat-messages">
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

            {/* 입력 폼 */}
            <form onSubmit={handleSubmit} className="chat-form">
              <label className="chat-field">
                <span className="chat-label">차종 / 연식</span>
                <input
                  type="text"
                  value={carInfo}
                  onChange={(e) => setCarInfo(e.target.value)}
                  placeholder="예) 2018 그랜저IG / BMW F10"
                />
              </label>

              <label className="chat-field">
                <span className="chat-label">연락처 (필수)</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="예) 010-1234-5678"
                  required
                />
              </label>

              <label className="chat-field">
                <span className="chat-label">위치</span>
                <input
                  type="text"
                  value={locationText}
                  onChange={(e) => setLocationText(e.target.value)}
                  placeholder="예) 동구 검사동 / ○○아파트 주차장"
                />
              </label>

              <label className="chat-field">
                <span className="chat-label">문의 내용</span>
                <textarea
                  rows={3}
                  value={msgInput}
                  onChange={(e) => setMsgInput(e.target.value)}
                  placeholder="예) 스마트키 분실 / 예비키 제작 가능 여부"
                />
              </label>

              {error && <div className="chat-error">{error}</div>}

              <button
                type="submit"
                className="chat-submit-btn"
                disabled={sending}
              >
                {sending ? "전송 중..." : "문의 보내기"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
