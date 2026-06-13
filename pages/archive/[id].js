// pages/archive/[id].js
import Head from "next/head";
import { getSummary, listSummaryIds } from "../../lib/redis";
import { useState } from "react";

const PHONE = "010-3503-6919";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://smilekey.me";

export async function getStaticPaths() {
  try {
    const ids = await listSummaryIds(30);
    return {
      paths: ids.map((id) => ({ params: { id } })),
      fallback: "blocking",
    };
  } catch {
    return { paths: [], fallback: "blocking" };
  }
}

export async function getStaticProps({ params }) {
  const { id } = params;
  try {
    const item = await getSummary(id);
    if (!item) return { notFound: true };
    return {
      props: { item: { ...item, id } },
      revalidate: 3600,
    };
  } catch {
    return { notFound: true };
  }
}

export default function ArchiveDetail({ item }) {
  const [lang, setLang] = useState("ko");

  const summaryByLang =
    lang === "en"
      ? item.summary_en || ""
      : lang === "zh"
      ? item.summary_zh || ""
      : item.summary_ko || item.summary || "";

  const hasKo = !!(item.summary_ko || item.summary);
  const hasEn = !!item.summary_en;
  const hasZh = !!item.summary_zh;

  const safeTitle = item?.title?.trim() || "요약";
  const pageTitle = `${safeTitle} | 대구 중앙열쇠`;

  const baseDesc =
    (item.summary_ko || item.summary || item.excerpt || safeTitle).trim();
  const desc = `${baseDesc} – 대구 동구 중앙열쇠 자동차키·스마트키·도어락`
    .replace(/\s+/g, " ")
    .slice(0, 155);

  const canonical = `${SITE_URL}/archive/${encodeURIComponent(item.id)}`;
  const ogImage = item.thumbnail
    ? item.thumbnail.startsWith("http")
      ? item.thumbnail
      : `${SITE_URL}${item.thumbnail}`
    : null;

  // 네이버/구글 날짜: item.date가 "2024-01-15" 또는 "2024-01-15 10:00" 형태
  const dateStr = (item.date || "").trim();
  const dateIso = dateStr
    ? new Date(dateStr).toISOString()
    : new Date().toISOString();

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: safeTitle,
    description: desc,
    url: canonical,
    datePublished: dateIso,
    dateModified: dateIso,
    author: {
      "@type": "LocalBusiness",
      name: "중앙열쇠",
      url: SITE_URL,
      telephone: PHONE,
    },
    publisher: {
      "@type": "LocalBusiness",
      name: "중앙열쇠",
      url: SITE_URL,
    },
    ...(ogImage ? { image: ogImage } : {}),
    inLanguage: "ko-KR",
  };

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href={canonical} />

        {/* 네이버 날짜 표시용 */}
        <meta property="article:published_time" content={dateIso} />
        <meta property="article:modified_time" content={dateIso} />
        <meta property="article:author" content="중앙열쇠" />

        {/* OG */}
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={desc} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="article" />
        <meta property="og:locale" content="ko_KR" />
        <meta property="og:site_name" content="중앙열쇠" />
        {ogImage && <meta property="og:image" content={ogImage} />}

        {/* hreflang */}
        <link rel="alternate" hrefLang="ko" href={canonical} />
        <link rel="alternate" hrefLang="x-default" href={canonical} />

        {/* Article 구조화 데이터 */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
        />
      </Head>

      <main className="container">
        <header className="header">
          <div className="header-badge">{item.source}</div>
          <h1 className="header-title">{safeTitle}</h1>
          <p className="header-sub">{dateStr}</p>
        </header>

        <div style={{ marginTop: 8 }}>
          <a href="/" style={{ fontSize: 13, opacity: 0.75 }}>
            ← 홈으로 (전화·위치·출장 지역 보기)
          </a>
        </div>

        <section className="card">
          {ogImage && (
            <div style={{ marginBottom: 12 }}>
              <img
                src={ogImage}
                alt={safeTitle}
                style={{ width: "100%", borderRadius: 12, display: "block" }}
                loading="lazy"
              />
            </div>
          )}

          {Array.isArray(item.images) && item.images.length > 0 && (
            <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
              {item.images.slice(ogImage ? 1 : 0, 5).map((src, i) => (
                <img
                  key={i}
                  src={src.startsWith("http") ? src : `${SITE_URL}${src}`}
                  alt={`${safeTitle} ${i + 1}`}
                  style={{ width: "100%", borderRadius: 12, display: "block" }}
                  loading="lazy"
                />
              ))}
            </div>
          )}

          {/* 언어 토글 */}
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            {[
              { key: "ko", label: "한국어", has: hasKo },
              { key: "en", label: "English", has: hasEn },
              { key: "zh", label: "中文", has: hasZh },
            ].map(({ key, label, has }) => (
              <button
                key={key}
                type="button"
                onClick={() => setLang(key)}
                disabled={!has}
                style={{
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.15)",
                  background: lang === key ? "rgba(0,0,0,0.06)" : "transparent",
                  opacity: has ? 1 : 0.4,
                  cursor: has ? "pointer" : "not-allowed",
                  fontSize: 13,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {summaryByLang ? (
            <p style={{ whiteSpace: "pre-line", fontSize: 14, lineHeight: 1.7 }}>
              {summaryByLang}
            </p>
          ) : (
            <p style={{ color: "#9ca3af" }}>(요약 없음)</p>
          )}

          <a
            href={item.link}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 13, color: "#16a34a" }}
          >
            원문 보기 →
          </a>
        </section>

        <section className="card">
          <strong>📞 차량 키·스마트키·도어락 문의</strong>
          <p style={{ marginTop: 6, fontSize: 13, color: "#374151" }}>
            대구 동구 중앙열쇠는 자동차 키 분실, 스마트키 제작,
            도어락 설치를 도와드립니다.
          </p>
          <a href={`tel:${PHONE}`} className="call-button">
            {PHONE} 전화하기
          </a>
        </section>
      </main>
    </>
  );
}
