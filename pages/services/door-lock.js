// pages/services/door-lock.js
import Head from "next/head";
import Link from "next/link";

const PHONE = "010-3503-6919";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "대구 도어락 설치 · 교체",
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
    "대구 도어락 설치·교체·비밀번호 초기화. 가정용·사무실·원룸·오피스텔. 대구 전 지역 현장 출장.",
};

const FAQ = [
  {
    q: "도어락 비밀번호를 잊어버렸는데 열 수 있나요?",
    a: "현장 방문 후 비밀번호 초기화 또는 도어락 교체를 도와드립니다. 본인 확인이 필요하오니 신분증을 준비해 주세요.",
  },
  {
    q: "어떤 종류의 도어락을 설치할 수 있나요?",
    a: "번호키, 지문인식, 카드키, 스마트폰 연동 등 모든 타입의 도어락 설치·교체가 가능합니다. 설치 전 제품 추천도 해드립니다.",
  },
  {
    q: "원룸·오피스텔도 출장 가능한가요?",
    a: "가정, 원룸, 오피스텔, 사무실 등 모두 출장 가능합니다. 대구 전 지역에서 당일 방문을 목표로 합니다.",
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

export default function DoorLockPage() {
  return (
    <>
      <Head>
        <title>대구 도어락 설치 · 교체 – 중앙열쇠 | 비밀번호 초기화 · 출장</title>
        <meta
          name="description"
          content="대구 도어락 설치·교체·비밀번호 초기화. 가정·원룸·오피스텔·사무실. 대구 전 지역 당일 출장. 중앙열쇠 010-3503-6919"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="canonical" href="https://smilekey.me/services/door-lock" />
        <meta property="og:title" content="대구 도어락 설치 · 교체 – 중앙열쇠" />
        <meta property="og:description" content="대구 도어락 설치·교체·비밀번호 초기화. 가정·원룸·오피스텔·사무실. 대구 전 지역 당일 출장." />
        <meta property="og:url" content="https://smilekey.me/services/door-lock" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://smilekey.me/og-image.png" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      </Head>

      <main className="container">
        <header className="header">
          <div className="header-badge">대구 동구 · 도어락 전문</div>
          <h1 className="header-title">대구 도어락 설치 · 교체</h1>
          <p className="header-sub">가정 · 원룸 · 오피스텔 · 사무실 · 대구 전 지역 출장</p>
        </header>

        <section className="card" style={{ marginBottom: "1rem" }}>
          <a href={`tel:${PHONE}`} className="call-button">📞 {PHONE}</a>
          <p className="call-caption">도어락 설치·비밀번호 문의는 <strong>전화가 가장 빠릅니다.</strong></p>
        </section>

        <section className="card">
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.75rem" }}>서비스 안내</h2>
          <ul style={{ lineHeight: 2, paddingLeft: "1.2rem" }}>
            <li><strong>도어락 신규 설치</strong> – 번호키·지문인식·카드키·스마트폰 연동</li>
            <li><strong>도어락 교체</strong> – 노후화, 고장, 보안 업그레이드</li>
            <li><strong>비밀번호 초기화</strong> – 번호 분실·잠금 해제</li>
            <li><strong>도어락 수리</strong> – 버튼 불량, 배터리 오류, 잠금 불량</li>
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
