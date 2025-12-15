// pages/archive/[id].js
import Head from "next/head";
import { getSummary } from "../../lib/redis";

export async function getServerSideProps({ params }) {
  const { id } = params;

  const item = await getSummary(id);
  if (!item) return { notFound: true };

  return { props: { item: { ...item, id } } };
}

export default function ArchiveDetail({ item }) {
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

        <section className="card">

            {item.thumbnail ? (
  <div style={{ marginBottom: 12 }}>
    <img
      src={ogImage}
      alt={safeTitle}
      style={{ width: "100%", borderRadius: 12, display: "block" }}
      loading="lazy"
    />
  </div>
) : null}

          {item.summary ? <p>{item.summary}</p> : <p>(요약 없음)</p>}
          <a href={item.link} target="_blank" rel="noreferrer">
            원문 보기
          </a>
        </section>
      </main>
    </>
  );
}
