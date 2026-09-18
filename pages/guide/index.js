// pages/guide/index.js — 안내 가이드 목록 (상황별·키 종류별·차종별)
import Head from "next/head";
import Link from "next/link";
import guideIndex from "../../content/guide/index.json";

const PHONE = "010-3503-6919";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://smilekey.me";
const GROUPS = ["상황", "키 종류", "차종", "지역"];

export default function GuideIndex() {
  const canonical = `${SITE_URL}/guide`;
  const byGroup = GROUPS.map((g) => ({ group: g, items: guideIndex.filter((x) => x.group === g) })).filter((x) => x.items.length);

  const listJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "대구 자동차키·스마트키 안내 가이드",
    itemListElement: guideIndex.map((g, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: g.title,
      url: `${SITE_URL}/guide/${g.slug}`,
    })),
  };

  return (
    <>
      <Head>
        <title>대구 차키 분실·스마트키 안내 가이드 – 중앙열쇠</title>
        <meta
          name="description"
          content="차키를 잃어버렸을 때, 차 안에 키를 두고 잠겼을 때, 차종별 스마트키 제작까지. 대구 동구 중앙열쇠의 실제 작업 기록을 바탕으로 정리한 안내 가이드."
        />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content="대구 차키 분실·스마트키 안내 가이드 – 중앙열쇠" />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="website" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(listJsonLd) }} />
      </Head>

      <main className="container">
        <header className="header">
          <div className="header-badge">대구 동구 · 자동차키 전문</div>
          <h1 className="header-title">차키·스마트키 안내 가이드</h1>
          <p className="header-sub">실제 작업 기록 {guideIndex.reduce((a, g) => a + (g.evidence_hits || 0), 0) ? "수백 건" : ""}을 바탕으로 상황별·차종별로 정리했습니다</p>
        </header>

        <section className="card" style={{ marginBottom: "1rem" }}>
          <a href={`tel:${PHONE}`} className="call-button">📞 {PHONE}</a>
          <p className="call-caption">급하시면 읽지 마시고 <strong>바로 전화</strong>하셔도 됩니다.</p>
        </section>

        {byGroup.map(({ group, items }) => (
          <section className="card" key={group} style={{ marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.6rem" }}>{group}별 안내</h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {items.map((g) => (
                <li key={g.slug} style={{ padding: "0.6rem 0", borderTop: "1px solid #eee" }}>
                  <Link href={`/guide/${g.slug}`} style={{ fontWeight: 600, color: "#1e40af" }}>
                    {g.title}
                  </Link>
                  {g.hook ? <p style={{ margin: "0.25rem 0 0", color: "#555", fontSize: "0.92rem", lineHeight: 1.6 }}>{g.hook}</p> : null}
                  {g.evidence_hits ? <p style={{ margin: "0.2rem 0 0", color: "#6b7280", fontSize: "0.8rem" }}>근거 사례 {g.evidence_hits}건</p> : null}
                </li>
              ))}
            </ul>
          </section>
        ))}

        <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
          <Link href="/" style={{ color: "#1e40af", textDecoration: "underline", fontSize: "0.9rem" }}>← 중앙열쇠 홈으로</Link>
        </div>
      </main>

      <a href={`tel:${PHONE}`} className="fixed-call-bar">
        <div className="fixed-call-bar-text">📞 중앙열쇠 전화하기</div>
      </a>
    </>
  );
}
