// components/AskWidget.js — 전 페이지 하단 "물어보기" 버튼 + 질문 패널
//   질문 → POST /api/ask → /api/ask/answer 폴링(2.5초, 최대 100초) → 답변 + 전화/문자 버튼
//   AI·구글 유입은 전화보다 문자를 고르는 층이라(2026-09 실측) 글로 묻는 창구가 필요했다. 답변 목적은 상담이 아니라 전화·문자로 넘기는 것.
import { useEffect, useRef, useState } from "react";

const PHONE = "010-3503-6919";
const POLL_MS = 2500;
const POLL_MAX_MS = 100_000;
const STORE = "smilekey-ask";

const ga = (name, params = {}) => {
  if (typeof window !== "undefined" && typeof window.gtag === "function") window.gtag("event", name, { event_category: "ask", ...params });
};

const btn = { display: "block", textAlign: "center", padding: "0.7rem 0.9rem", borderRadius: 10, fontWeight: 700, textDecoration: "none", fontSize: 14 };

export default function AskWidget() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [phone, setPhone] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | waiting | ready | timeout | error | limited
  const [answer, setAnswer] = useState(null); // { reply, link }
  const [elapsed, setElapsed] = useState(0);
  const pollRef = useRef(null);

  const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

  // 답을 기다리다 페이지를 옮겨도 같은 세션이면 이어서 받는다
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE) || "null");
      if (!saved || Date.now() - saved.ts > 10 * 60_000) return;
      setQuestion(saved.question || "");
      if (saved.reply) { setAnswer({ reply: saved.reply, link: saved.link || "" }); setState("ready"); }
      else if (saved.id) { setState("waiting"); startPolling(saved.id, saved.ts); }
    } catch {}
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startPolling(id, startedAt) {
    stopPolling();
    const t0 = startedAt || Date.now();
    pollRef.current = setInterval(async () => {
      const passed = Date.now() - t0;
      setElapsed(Math.round(passed / 1000));
      if (passed > POLL_MAX_MS) { stopPolling(); setState("timeout"); ga("ask_timeout"); return; }
      try {
        const r = await fetch(`/api/ask/answer?id=${encodeURIComponent(id)}`, { cache: "no-store" });
        const d = await r.json();
        if (d.status === "ready") {
          stopPolling();
          setAnswer({ reply: d.reply, link: d.link });
          setState("ready");
          ga("ask_answered", { value: Math.round(passed / 1000) });
          try { sessionStorage.setItem(STORE, JSON.stringify({ id, question, ts: t0, reply: d.reply, link: d.link })); } catch {}
        }
      } catch {}
    }, POLL_MS);
  }

  async function submit(e) {
    e.preventDefault();
    const q = question.trim();
    if (q.length < 5) return;
    setState("sending");
    ga("ask_submit", { has_phone: phone ? 1 : 0 });
    try {
      const r = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, phone: phone.trim(), page: window.location.pathname, website: e.target.website?.value || "" }),
      });
      if (r.status === 429) { setState("limited"); return; }
      const d = await r.json();
      if (!d.ok || !d.id) { setState("error"); return; }
      const ts = Date.now();
      try { sessionStorage.setItem(STORE, JSON.stringify({ id: d.id, question: q, ts })); } catch {}
      setState("waiting");
      setElapsed(0);
      startPolling(d.id, ts);
    } catch {
      setState("error");
    }
  }

  function reset() {
    stopPolling();
    setState("idle"); setAnswer(null); setQuestion(""); setPhone(""); setElapsed(0);
    try { sessionStorage.removeItem(STORE); } catch {}
  }

  const toggle = () => { const next = !open; setOpen(next); if (next) ga("ask_open"); };

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label="질문하기"
        style={{
          position: "fixed", right: 14, bottom: "calc(66px + env(safe-area-inset-bottom))", zIndex: 1001,
          background: "#1e40af", color: "#fff", border: 0, borderRadius: 999, padding: "10px 16px",
          fontSize: 14, fontWeight: 700, boxShadow: "0 6px 16px rgba(30,64,175,0.35)", cursor: "pointer",
        }}
      >
        {open ? "닫기 ✕" : "💬 물어보기"}
      </button>

      {open && (
        <section
          role="dialog"
          aria-label="중앙열쇠에 질문하기"
          style={{
            position: "fixed", right: 12, bottom: "calc(112px + env(safe-area-inset-bottom))", zIndex: 1000,
            width: "min(360px, calc(100vw - 24px))", maxHeight: "70vh", overflowY: "auto",
            background: "#fff", borderRadius: 16, boxShadow: "0 12px 32px rgba(15,23,42,0.25)", padding: "14px 14px 12px",
            border: "1px solid #e5e7eb", fontSize: 14, lineHeight: 1.6, color: "#111827",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>중앙열쇠에 물어보기</div>
          <p style={{ margin: "0 0 10px", color: "#6b7280", fontSize: 12.5 }}>
            차종·상황을 적어 주시면 보통 30초 안에 답해 드립니다. 급하시면 <a href={`tel:${PHONE}`} style={{ color: "#1e40af", fontWeight: 700 }}>전화 {PHONE}</a>가 가장 빠릅니다.
          </p>

          {(state === "idle" || state === "sending" || state === "error" || state === "limited") && (
            <form onSubmit={submit}>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={1000}
                rows={4}
                required
                placeholder="예) 2018년식 그랜저 스마트키를 다 잃어버렸는데 현장에서 만들 수 있나요?"
                style={{ width: "100%", boxSizing: "border-box", padding: 10, borderRadius: 10, border: "1px solid #d1d5db", fontSize: 14, resize: "vertical" }}
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                maxLength={20}
                placeholder="회신 받을 전화번호 (선택)"
                style={{ width: "100%", boxSizing: "border-box", marginTop: 8, padding: 10, borderRadius: 10, border: "1px solid #d1d5db", fontSize: 14 }}
              />
              {/* 허니팟: 사람은 못 보고 봇만 채운다 */}
              <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }} />
              <button
                type="submit"
                disabled={state === "sending" || question.trim().length < 5}
                style={{ ...btn, width: "100%", marginTop: 10, background: state === "sending" ? "#93a4d9" : "#1e40af", color: "#fff", border: 0, cursor: "pointer" }}
              >
                {state === "sending" ? "보내는 중…" : "질문 보내기"}
              </button>
              {state === "error" && <p style={{ margin: "8px 0 0", color: "#b91c1c", fontSize: 13 }}>접수에 실패했습니다. 전화로 문의해 주세요.</p>}
              {state === "limited" && <p style={{ margin: "8px 0 0", color: "#b91c1c", fontSize: 13 }}>질문이 많이 접수되어 잠시 쉬고 있습니다. 전화로 문의해 주세요.</p>}
              <p style={{ margin: "10px 0 0", color: "#9ca3af", fontSize: 11.5 }}>
                문 여는 방법과 금액은 답하지 않습니다. 정확한 비용은 전화로 안내합니다. 입력 내용은 답변과 연락 목적에만 쓰고 30일 뒤 삭제됩니다.
              </p>
            </form>
          )}

          {state === "waiting" && (
            <div style={{ padding: "8px 0" }}>
              <div style={{ background: "#f3f4f6", borderRadius: 10, padding: 10, fontSize: 13, color: "#374151", marginBottom: 10 }}>{question}</div>
              <p style={{ margin: 0 }}>답변을 작성하고 있습니다… <span style={{ color: "#6b7280" }}>({elapsed}초)</span></p>
              <p style={{ margin: "6px 0 0", color: "#6b7280", fontSize: 12.5 }}>보통 30초 안에 옵니다. 기다리기 어려우시면 전화 주세요.</p>
              <a href={`tel:${PHONE}`} onClick={() => ga("ask_to_call", { stage: "waiting" })} style={{ ...btn, marginTop: 10, background: "#22c55e", color: "#fff" }}>📞 {PHONE}</a>
            </div>
          )}

          {state === "ready" && answer && (
            <div style={{ padding: "4px 0" }}>
              <div style={{ background: "#f3f4f6", borderRadius: 10, padding: 10, fontSize: 13, color: "#374151", marginBottom: 10 }}>{question}</div>
              <div style={{ whiteSpace: "pre-wrap" }}>{answer.reply}</div>
              {answer.link && (
                <p style={{ margin: "8px 0 0", fontSize: 13 }}>
                  <a href={answer.link} style={{ color: "#1e40af", textDecoration: "underline" }}>자세한 안내 글 보기 →</a>
                </p>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                <a href={`tel:${PHONE}`} onClick={() => ga("ask_to_call", { stage: "ready" })} style={{ ...btn, background: "#22c55e", color: "#fff" }}>📞 전화하기</a>
                <a href={`sms:${PHONE}`} onClick={() => ga("ask_to_sms", { stage: "ready" })} style={{ ...btn, background: "#eff6ff", color: "#1e40af", border: "1.5px solid #1e40af" }}>💬 문자하기</a>
              </div>
              <p style={{ margin: "8px 0 0", textAlign: "center", color: "#6b7280", fontSize: 12.5 }}>{PHONE} · PC에서는 누르면 번호가 복사됩니다</p>
              <button type="button" onClick={reset} style={{ marginTop: 10, background: "none", border: 0, color: "#6b7280", fontSize: 12.5, cursor: "pointer", textDecoration: "underline" }}>다른 질문 하기</button>
            </div>
          )}

          {state === "timeout" && (
            <div style={{ padding: "4px 0" }}>
              <p style={{ margin: 0 }}>지금은 바로 답을 드리기 어렵습니다. 질문은 접수되어 있으니, 급하시면 전화 주시면 바로 안내드립니다.</p>
              <a href={`tel:${PHONE}`} onClick={() => ga("ask_to_call", { stage: "timeout" })} style={{ ...btn, marginTop: 10, background: "#22c55e", color: "#fff" }}>📞 {PHONE}</a>
              <button type="button" onClick={reset} style={{ marginTop: 10, background: "none", border: 0, color: "#6b7280", fontSize: 12.5, cursor: "pointer", textDecoration: "underline" }}>다른 질문 하기</button>
            </div>
          )}
        </section>
      )}
    </>
  );
}
