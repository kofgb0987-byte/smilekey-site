// pages/services/smart-key.js
import Head from "next/head";
import Link from "next/link";

const PHONE = "010-3503-6919";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "대구 수입차 스마트키 · 폴딩키 제작",
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
    "대구 벤츠·BMW·아우디·폭스바겐 등 수입차 스마트키 제작·등록, 폴딩키 복사. 대구 전 지역 현장 출장.",
};

const FAQ = [
  {
    q: "수입차 스마트키도 제작할 수 있나요?",
    a: "벤츠, BMW, 아우디, 폭스바겐, 볼보 등 대부분의 수입차 스마트키 제작·등록이 가능합니다. 차종과 연식에 따라 제한이 있을 수 있으니 먼저 전화로 확인해 주세요.",
  },
  {
    q: "폴딩키(접이식 키)는 얼마나 걸리나요?",
    a: "폴딩키는 차종에 따라 다르지만 대부분 현장에서 30~60분 안에 제작·등록됩니다. 일부 고급 수입차는 딜러 연동이 필요할 수 있습니다.",
  },
  {
    q: "스마트키 배터리 교체도 되나요?",
    a: "네, 스마트키 배터리 교체도 가능합니다. 배터리 교체 후 인식이 안 될 경우 재등록도 함께 도와드립니다.",
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

export default function SmartKeyPage() {
  return (
    <>
      <Head>
        <title>대구 수입차 스마트키 · 폴딩키 제작 – 중앙열쇠 | 벤츠 BMW 아우디</title>
        <meta
          name="description"
          content="대구 벤츠·BMW·아우디·폭스바겐 수입차 스마트키 제작·등록, 폴딩키 복사. 대구 전 지역 현장 출장. 중앙열쇠 010-3503-6919"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="canonical" href="https://smilekey.me/services/smart-key" />
        <meta property="og:title" content="대구 수입차 스마트키 · 폴딩키 제작 – 중앙열쇠" />
        <meta property="og:description" content="대구 벤츠·BMW·아우디·폭스바겐 수입차 스마트키 제작·등록, 폴딩키 복사. 대구 전 지역 출장." />
        <meta property="og:url" content="https://smilekey.me/services/smart-key" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://smilekey.me/og-image.png" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      </Head>

      <main className="container">
        <header className="header">
          <div className="header-badge">대구 동구 · 수입차 스마트키 전문</div>
          <h1 className="header-title">대구 수입차 스마트키 · 폴딩키</h1>
          <p className="header-sub">벤츠 · BMW · 아우디 · 폭스바겐 · 볼보 · 렉서스</p>
        </header>

        <section className="card" style={{ marginBottom: "1rem" }}>
          <a href={`tel:${PHONE}`} className="call-button">📞 {PHONE}</a>
          <p className="call-caption">스마트키·폴딩키 문의는 <strong>전화로 먼저 확인</strong>해 주세요.</p>
        </section>

        <section className="card">
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.75rem" }}>서비스 안내</h2>
          <ul style={{ lineHeight: 2, paddingLeft: "1.2rem" }}>
            <li><strong>수입차 스마트키 제작·등록</strong> – 벤츠·BMW·아우디·폭스바겐 등</li>
            <li><strong>폴딩키(접이식 키) 복사·제작</strong> – 국산·수입 전 차종</li>
            <li><strong>스마트키 배터리 교체</strong> + 재인식 등록</li>
            <li><strong>키리스 엔트리 불량</strong> – 버튼 불량, 인식 오류 해결</li>
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
