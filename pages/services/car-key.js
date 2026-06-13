// pages/services/car-key.js
import Head from "next/head";
import Link from "next/link";

const PHONE = "010-3503-6919";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "대구 자동차 키 복사 · 분실 제작",
  provider: {
    "@type": "LocalBusiness",
    name: "중앙열쇠",
    telephone: PHONE,
    address: {
      "@type": "PostalAddress",
      addressLocality: "대구광역시 동구",
      streetAddress: "검사동",
      addressCountry: "KR",
    },
  },
  areaServed: "대구광역시",
  description:
    "대구 자동차 키 복사, 차키 분실 제작, 예비키 제작. 현장 출장 가능. 국산·수입 모든 차종 대응.",
};

const FAQ = [
  {
    q: "차 키를 완전히 잃어버렸는데도 만들 수 있나요?",
    a: "차량 번호와 차종, 현재 위치를 알려주시면 현장 방문 후 새로 제작해 드립니다. 일부 차량은 ECU 초기화 작업이 필요할 수 있으니 전화 상담 후 방문합니다.",
  },
  {
    q: "예비키 제작은 얼마나 걸리나요?",
    a: "일반 기계식 키는 현장에서 5~10분, 트랜스폰더·스마트키는 차종에 따라 20~60분 정도 소요됩니다.",
  },
  {
    q: "대구 어느 지역까지 출장되나요?",
    a: "대구 전 지역 출장 가능합니다. 동구·수성구·북구는 비교적 빠르게 방문 가능하며, 위치를 알려주시면 소요 시간을 안내해 드립니다.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
};

export default function CarKeyPage() {
  return (
    <>
      <Head>
        <title>대구 차키 복사 · 분실 제작 – 중앙열쇠 | 대구 자동차키 전문</title>
        <meta
          name="description"
          content="대구 자동차 키 복사, 차키 분실 제작, 예비키 제작. 국산·수입차 전 차종. 대구 전 지역 현장 출장. 중앙열쇠 010-3503-6919"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="canonical" href="https://smilekey.me/services/car-key" />
        <meta property="og:title" content="대구 차키 복사 · 분실 제작 – 중앙열쇠" />
        <meta property="og:description" content="대구 자동차 키 복사, 차키 분실 제작, 예비키 제작. 국산·수입차 전 차종. 대구 전 지역 출장." />
        <meta property="og:url" content="https://smilekey.me/services/car-key" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://smilekey.me/og-image.png" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      </Head>

      <main className="container">
        <header className="header">
          <div className="header-badge">대구 동구 · 자동차 키 전문</div>
          <h1 className="header-title">대구 자동차 키 복사 · 분실 제작</h1>
          <p className="header-sub">국산·수입차 전 차종 · 대구 전 지역 출장</p>
        </header>

        <section className="card" style={{ marginBottom: "1rem" }}>
          <a href={`tel:${PHONE}`} className="call-button">📞 {PHONE}</a>
          <p className="call-caption">차키 분실 · 예비키 제작은 <strong>전화가 가장 빠릅니다.</strong></p>
        </section>

        <section className="card">
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.75rem" }}>서비스 안내</h2>
          <ul style={{ lineHeight: 2, paddingLeft: "1.2rem" }}>
            <li><strong>차키 분실 제작</strong> – 키 없이 차종·차량번호만으로 현장 제작</li>
            <li><strong>예비키 복사</strong> – 기계식·트랜스폰더 키 모두 가능</li>
            <li><strong>시동 불가 해결</strong> – 키 인식 불량, 배터리 방전 후 재등록</li>
            <li><strong>차량 내부 잠금 해제</strong> – 키 안에 두고 문 잠긴 경우</li>
          </ul>
        </section>

        <section className="card" style={{ marginTop: "1rem" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.75rem" }}>자주 묻는 질문</h2>
          {FAQ.map(({ q, a }, i) => (
            <div key={i} style={{ marginBottom: "0.9rem" }}>
              <p style={{ fontWeight: 600, marginBottom: "0.25rem" }}>Q. {q}</p>
              <p style={{ color: "#555", lineHeight: 1.7 }}>A. {a}</p>
            </div>
          ))}
        </section>

        <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
          <Link href="/" style={{ color: "#1e40af", textDecoration: "underline", fontSize: "0.9rem" }}>
            ← 중앙열쇠 홈으로
          </Link>
        </div>
      </main>

      <a href={`tel:${PHONE}`} className="fixed-call-bar">
        <div className="fixed-call-bar-text">📞 중앙열쇠 전화하기</div>
      </a>
    </>
  );
}
