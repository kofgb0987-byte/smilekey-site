// pages/archive/[id].js
import Head from "next/head";
import { getSummary } from "../../lib/redis";
import { useState } from "react";
const PHONE = "010-3503-6919";

export async function getServerSideProps({ params }) {
  const { id } = params;

  const item = await getSummary(id);
  if (!item) return { notFound: true };

  return { props: { item: { ...item, id } } };
}

export default function ArchiveDetail({ item }) {

    const [lang, setLang] = useState("ko");

const summaryByLang =
  lang === "en"
    ? (item.summary_en || "")
    : lang === "zh"
      ? (item.summary_zh || "")
      : (item.summary_ko || item.summary || "");

const hasKo = !!(item.summary_ko || item.summary);
const hasEn = !!item.summary_en;
const hasZh = !!item.summary_zh;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://smilekey.me";

  const safeTitle = item?.title?.trim() || "요약";
  const title = `${safeTitle} | 대구 중앙열쇠 smilekey`;

  const baseDesc =
    (item.summary && item.summary.trim()) ||
    (item.excerpt && item.excerpt.trim()) ||
    safeTitle;

  const desc = `${baseDesc} 대구 동구 중앙열쇠 | 자동차키·스마트키·도어락`
    .replace(/\s+/g, " ")
    .slice(0, 155);

  const canonical = `${siteUrl}/archive/${encodeURIComponent(item.id)}`;
const ogImage = item.thumbnail
  ? (item.thumbnail.startsWith("http")
      ? item.thumbnail
      : `${siteUrl}${item.thumbnail}`)
  : null;

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href={canonical} />

        <meta property="og:title" content={title} />
        <meta property="og:description" content={desc} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="article" />
        {ogImage ? <meta property="og:image" content={ogImage} /> : null}

      </Head>

      <main className="container">
        <header className="header">

          <div className="header-badge">{item.source}</div>
          <h1 className="header-title">{safeTitle}</h1>
          <p className="header-sub">{item.date}</p>
        </header>

          <div style={{ marginTop: 8 }}>
  <a href="/" style={{ fontSize: 13, opacity: 0.75 }}>
    ← 홈으로 (전화·위치·출장 지역 보기)
  </a>
</div>

        <section className="card">

            {ogImage ? (
  <div style={{ marginBottom: 12 }}>
    <img
      src={ogImage}
      alt={safeTitle}
      style={{ width: "100%", borderRadius: 12, display: "block" }}
      loading="lazy"
    />
  </div>
) : null}


          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
  <button
    type="button"
    onClick={() => setLang("ko")}
    disabled={!hasKo}
    style={{
      padding: "6px 10px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,0.15)",
      background: lang === "ko" ? "rgba(0,0,0,0.06)" : "transparent",
      opacity: hasKo ? 1 : 0.4,
      cursor: hasKo ? "pointer" : "not-allowed",
    }}
  >
    한국어
  </button>

  <button
    type="button"
    onClick={() => setLang("en")}
    disabled={!hasEn}
    style={{
      padding: "6px 10px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,0.15)",
      background: lang === "en" ? "rgba(0,0,0,0.06)" : "transparent",
      opacity: hasEn ? 1 : 0.4,
      cursor: hasEn ? "pointer" : "not-allowed",
    }}
  >
    English
  </button>

  <button
    type="button"
    onClick={() => setLang("zh")}
    disabled={!hasZh}
    style={{
      padding: "6px 10px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,0.15)",
      background: lang === "zh" ? "rgba(0,0,0,0.06)" : "transparent",
      opacity: hasZh ? 1 : 0.4,
      cursor: hasZh ? "pointer" : "not-allowed",
    }}
  >
    中文
  </button>
</div>

{summaryByLang ? <p>{summaryByLang}</p> : <p>(요약 없음)</p>}
          <a href={item.link} target="_blank" rel="noreferrer">
            원문 보기
          </a>
        </section>

          <section className="card" style={{ marginTop: 16 }}>
  <strong>📞 차량 키·스마트키·도어락 문의</strong>
  <p style={{ marginTop: 6 }}>
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
