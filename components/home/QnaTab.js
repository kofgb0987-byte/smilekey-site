// components/home/QnaTab.js
import { useState } from "react";

const FAQS = [
  {
    q: "Q. 차 키를 완전히 잃어버렸는데도 만들 수 있나요?",
    a: "차량 번호와 차종, 현재 위치를 알려주시면 현장 방문 후 키를 새로 제작해 드릴 수 있습니다. 일부 차량은 시동/도어락 초기화 작업이 필요할 수 있으니, 전화로 상황을 자세히 말씀해 주시면 가능한 방법과 대략 비용을 먼저 안내해 드립니다.",
  },
  {
    q: "Q. 대구 어느 지역까지 출장되나요?",
    a: "기본적으로 대구 전 지역 출장이 가능하며, 동구 · 수성구 · 북구는 비교적 빠르게 방문이 가능합니다. 정확한 소요 시간은 위치를 듣고 안내해 드립니다.",
  },
  {
    q: "Q. 수입차 스마트키도 복사할 수 있나요?",
    a: "벤츠, BMW, 아우디, 폭스바겐 등 대부분의 수입차는 작업이 가능하지만 일부 차종/연식은 제한이 있을 수 있습니다. 차량 제조사, 차종, 연식을 알려주시면 작업 가능 여부를 먼저 확인해 드립니다.",
  },
  {
    q: "Q. 비용은 어느 정도 생각하면 될까요?",
    a: "차량 종류, 키 타입(스마트키/폴딩키/일반키), 분실 여부, 위치에 따라 금액이 크게 달라집니다. 전화로 상황을 말씀해 주시면 가능한 범위 안에서 대략적인 비용을 먼저 안내해 드립니다.",
  },
  {
    q: "Q. 현금 말고 카드 결제도 가능한가요?",
    a: "네, 현금 · 계좌이체 · 카드 결제 모두 가능합니다. 필요하신 경우 현금영수증이나 세금계산서 발급도 도와드립니다. 작업 상황에 따라 가장 편하신 결제 방법으로 조율해 드리니, 전화 상담 시 함께 말씀해 주세요.",
  },
];

export default function QnaTab() {
  const [openIndex, setOpenIndex] = useState(null);

  function toggle(i) {
    setOpenIndex((prev) => (prev === i ? null : i));
  }

  return (
    <section className="card">
      <h2 className="section-title">자주 묻는 질문 (Q&A)</h2>

      {FAQS.map((faq, i) => (
        <div key={i} className="faq-item">
          <button
            type="button"
            className="faq-toggle"
            aria-expanded={openIndex === i}
            onClick={() => toggle(i)}
          >
            <span className="faq-q-text">{faq.q}</span>
            <span className="faq-chevron">{openIndex === i ? "▲" : "▼"}</span>
          </button>
          {openIndex === i && (
            <p className="faq-a">{faq.a}</p>
          )}
        </div>
      ))}
    </section>
  );
}
