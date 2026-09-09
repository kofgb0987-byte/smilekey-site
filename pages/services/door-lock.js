// pages/services/door-lock.js
import Head from "next/head";
import Link from "next/link";
import GuideLinks from "../../components/GuideLinks";

const PHONE = "010-3503-6919";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "대구 도어락 설치 · 교체 · 고장 수리",
  provider: {
    "@type": "LocalBusiness",
    name: "중앙열쇠",
    telephone: PHONE,
    address: {
      "@type": "PostalAddress",
      addressLocality: "대구광역시 동구",
      streetAddress: "동촌로 64",
      addressCountry: "KR",
    },
  },
  areaServed: "대구광역시",
  description:
    "대구 도어락 설치·교체·고장 수리·비밀번호 초기화·배터리 방전 개방. 삼성·게이트맨·푸쉬풀·탱크 등 전 브랜드 판매와 설치. 동구 동촌·검사동·방촌·신암·율하 및 대구 전 지역 당일 출장.",
};

const URGENT = [
  {
    title: "배터리가 방전돼 문이 안 열릴 때",
    body: "대부분의 디지털 도어락은 바깥쪽 아래에 9V 비상전원 단자가 있습니다. 편의점 9V 각형 건전지를 단자에 붙인 채 비밀번호를 누르면 한 번 열립니다. 단자가 없는 모델이거나 그래도 반응이 없으면 전화 주세요. 현장에서 개방한 뒤 배터리 교체까지 바로 마무리합니다.",
  },
  {
    title: "비밀번호를 잊었거나 바뀐 것 같을 때",
    body: "집 안에서 도어락을 만질 수 있으면 초기화로 새 번호를 등록해 드립니다. 밖에서 잠긴 상태라면 현장 개방 후 초기화 또는 교체를 진행합니다. 본인 확인이 필요하니 신분증을 준비해 주세요.",
  },
  {
    title: "버튼 반응이 없거나 에러음이 반복될 때",
    body: "배터리를 새것으로 갈아도 저전압 경고가 뜨거나, 잠금이 헛돌거나, 번호를 눌러도 반응이 없으면 모터나 기판 문제일 가능성이 큽니다. 현장에서 수리가 되는지 먼저 확인하고, 오래된 제품이라 수리보다 교체가 유리하면 비용을 비교해서 안내합니다.",
  },
];

const FAQ = [
  {
    q: "도어락 비밀번호를 잊어버렸는데 열 수 있나요?",
    a: "현장 방문 후 비밀번호 초기화 또는 도어락 교체를 도와드립니다. 본인 확인이 필요하오니 신분증을 준비해 주세요.",
  },
  {
    q: "문이 잠겨서 못 들어가는데 바로 와주시나요?",
    a: "위치와 상황을 알려주시면 소요 시간을 바로 안내해 드리고, 당일 최대한 빠르게 방문합니다. 개방 후 필요하면 교체까지 한 번에 진행할 수 있습니다.",
  },
  {
    q: "도어락 설치·교체 비용은 어떻게 정해지나요?",
    a: "제품 종류(번호키·지문·카드·푸쉬풀), 문 종류(현관문·방화문·유리문), 기존 도어락 철거 여부로 정해집니다. 전화로 문 종류와 원하는 타입을 말씀해 주시면 방문 전에 예상 총액을 먼저 안내해 드리고, 현장 상황이 다르면 작업 전에 먼저 말씀드립니다.",
  },
  {
    q: "이사 왔는데 도어락을 교체해야 하나요?",
    a: "전 거주자가 비밀번호나 카드키를 알고 있을 수 있어 최소한 비밀번호 초기화와 카드키 재등록은 권합니다. 제품이 오래됐거나 흔적이 많으면 교체가 안전하며, 방문 시 상태를 보고 판단을 도와드립니다.",
  },
  {
    q: "어떤 종류의 도어락을 설치할 수 있나요?",
    a: "번호키, 지문인식, 카드키, 푸쉬풀, 스마트폰 연동 등 모든 타입의 디지털 도어락 설치·교체가 가능합니다. 현관문·방화문·유리문 등 문 종류에 맞는 제품 추천도 해드립니다.",
  },
  {
    q: "도어락을 직접 사놨는데 설치만 맡겨도 되나요?",
    a: "네, 보유하신 제품 설치만도 가능합니다. 기존 도어락 철거를 포함해 진행하며, 문에 맞지 않는 제품일 경우 설치 전에 미리 알려드립니다.",
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

const h2 = { fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.75rem" };
const bodyText = { color: "#555", lineHeight: 1.7, margin: 0 };

export default function DoorLockPage() {
  return (
    <>
      <Head>
        <title>대구 도어락 설치 · 교체 · 고장 수리 – 중앙열쇠 | 비밀번호 분실 · 배터리 방전 당일 출장</title>
        <meta
          name="description"
          content="대구 도어락 설치·교체·고장 수리·비밀번호 초기화·배터리 방전 개방. 삼성·게이트맨·푸쉬풀·탱크 등 전 브랜드 판매+설치. 동구 동촌·검사동·방촌·신암·율하 및 대구 전 지역 당일 출장. 중앙열쇠 010-3503-6919"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="canonical" href="https://smilekey.me/services/door-lock" />
        <meta property="og:title" content="대구 도어락 설치 · 교체 · 고장 수리 – 중앙열쇠" />
        <meta property="og:description" content="도어락 설치·교체·고장 수리·비밀번호 초기화·배터리 방전 개방. 가정·원룸·오피스텔·사무실. 대구 전 지역 당일 출장." />
        <meta property="og:url" content="https://smilekey.me/services/door-lock" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://smilekey.me/og-image.png" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      </Head>

      <main className="container">
        <header className="header">
          <div className="header-badge">대구 동구 · 도어락 설치 · 수리</div>
          <h1 className="header-title">대구 도어락 설치 · 교체 · 고장 수리</h1>
          <p className="header-sub">비밀번호 분실 · 배터리 방전 · 노후 교체 · 대구 전 지역 출장</p>
        </header>

        <section className="card" style={{ marginBottom: "1rem" }}>
          <a href={`tel:${PHONE}`} className="call-button">📞 {PHONE}</a>
          <p className="call-caption">문이 안 열리는 상황은 <strong>전화가 가장 빠릅니다.</strong> 문 종류만 말씀하시면 예상 비용을 먼저 안내합니다.</p>
        </section>

        <section className="card">
          <h2 style={h2}>이런 상황이면 바로 전화하세요</h2>
          {URGENT.map(({ title, body }, i) => (
            <div key={i} style={{ marginBottom: i === URGENT.length - 1 ? 0 : "0.9rem" }}>
              <p style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{title}</p>
              <p style={bodyText}>{body}</p>
            </div>
          ))}
        </section>

        <section className="card" style={{ marginTop: "1rem" }}>
          <h2 style={h2}>서비스 안내</h2>
          <ul style={{ lineHeight: 2, paddingLeft: "1.2rem" }}>
            <li><strong>도어락 판매 + 신규 설치</strong> – 번호키·지문인식·카드키·푸쉬풀·스마트폰 연동, 제품 선택부터 설치까지 한 번에</li>
            <li><strong>도어락 교체</strong> – 노후화, 고장, 이사 후 보안 교체</li>
            <li><strong>잠긴 문 개방 · 비밀번호 초기화</strong> – 번호 분실, 배터리 방전</li>
            <li><strong>도어락 고장 수리</strong> – 버튼 불량, 에러음, 잠금 불량, 저전압 경고</li>
            <li><strong>현관문 · 방화문 · 유리문</strong> – 문 종류별 맞춤 시공</li>
          </ul>
        </section>

        <section className="card" style={{ marginTop: "1rem" }}>
          <h2 style={h2}>비용은 이렇게 정해집니다</h2>
          <ul style={{ lineHeight: 1.9, paddingLeft: "1.2rem", marginBottom: "0.6rem" }}>
            <li><strong>제품</strong> – 번호키가 가장 저렴하고 지문·카드, 푸쉬풀·얼굴인식 순으로 올라갑니다. 보유 제품 설치만도 가능합니다.</li>
            <li><strong>작업</strong> – 기존 도어락 철거 포함 여부, 현관문·방화문·유리문 등 문 종류에 따라 다릅니다. 유리문이나 새로 타공이 필요한 경우 추가됩니다.</li>
            <li><strong>출장</strong> – 대구 시내는 동일 기준이며, 야간·공휴일 출장은 별도 안내합니다.</li>
          </ul>
          <p style={bodyText}>
            전화로 문 종류와 원하는 타입만 말씀하시면 방문 전에 예상 총액을 먼저 알려드립니다. 현장 상황이 다르면 작업 전에 먼저 말씀드리고 진행합니다.
          </p>
        </section>

        <section className="card" style={{ marginTop: "1rem" }}>
          <h2 style={h2}>취급 브랜드</h2>
          <p style={bodyText}>
            삼성(SHP) · 게이트맨 · 푸쉬풀 도어락 · 탱크 · 솔리티 · 코콤 · 밀레시스텍 · 유니코 등{" "}
            <strong>디지털 도어락 전 브랜드</strong>를 판매하고 설치·수리합니다. 제품을 정하지
            못하셨다면 문 종류와 예산에 맞는 모델을 추천해 드립니다.
          </p>
        </section>

        <section className="card" style={{ marginTop: "1rem" }}>
          <h2 style={h2}>자주 묻는 질문</h2>
          {FAQ.map(({ q, a }, i) => (
            <div key={i} style={{ marginBottom: "0.9rem" }}>
              <p style={{ fontWeight: 600, marginBottom: "0.25rem" }}>Q. {q}</p>
              <p style={{ color: "#555", lineHeight: 1.7 }}>A. {a}</p>
            </div>
          ))}
        </section>

        <section className="card" style={{ marginTop: "1rem" }}>
          <h2 style={h2}>출장 지역</h2>
          <p style={bodyText}>
            동구 동촌로 64에서 출발합니다. <strong>동촌 · 검사동 · 방촌 · 신암 · 율하 · 효목 · 신천</strong> 등 동구는 더 빠르게 방문하며,
            수성구 · 북구 · 중구 · 서구 · 남구 · 달서구 · 달성군까지 대구 전 지역 당일 출장을 목표로 합니다.
          </p>
        </section>

        <section className="card" style={{ marginTop: "1rem" }}>
          <h2 style={h2}>자동차 키가 필요하세요?</h2>
          <p style={bodyText}>
            중앙열쇠의 주력은 자동차 키입니다.{" "}
            <Link href="/services/car-key" style={{ color: "#1e40af", fontWeight: 600 }}>
              차키 분실 제작
            </Link>
            {" · "}
            <Link href="/services/smart-key" style={{ color: "#1e40af", fontWeight: 600 }}>
              벤츠·BMW 등 수입차 스마트키 복사·제작
            </Link>
            도 대구 전 지역 출장으로 도와드립니다.
          </p>
        </section>

        <GuideLinks service="door-lock" />

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
