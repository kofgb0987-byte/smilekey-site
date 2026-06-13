// pages/archive/index.js
import Head from "next/head";
import Link from "next/link";
import { listSummaryIds, getSummary } from "../../lib/redis";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://smilekey.me";

export async function getStaticProps() {
  const ids = await listSummaryIds(50);

  const itemsRaw = await Promise.all(
    ids.map(async (id) => {
      const it = await getSummary(id);
      return it ? { ...it, id } : null;
    })
  );

  return {
    props: { items: itemsRaw.filter(Boolean) },
    revalidate: 300,
  };
}

export default function ArchiveList({ items }) {
  return (
    <>
      <Head>
        <title>작업 아카이브 | 대구 중앙열쇠</title>
        <meta
          name="description"
          content="대구 동구 중앙열쇠의 자동차 키·스마트키·도어락 작업 사례 모음. 유튜브·블로그 요약 아카이브."
        />
        <link rel="canonical" href={`${SITE_URL}/archive`} />
        <meta property="og:title" content="작업 아카이브 | 대구 중앙열쇠" />
        <meta property="og:url" content={`${SITE_URL}/archive`} />
        <meta property="og:type" content="website" />
      </Head>

      <main className="container">
        <header className="header">
          <h1 className="header-title">작업 아카이브</h1>
          <p className="header-sub">유튜브·블로그 요약 모음</p>
        </header>

        <div style={{ marginBottom: 12 }}>
          <Link href="/" style={{ fontSize: 13, opacity: 0.75 }}>
            ← 홈으로
          </Link>
        </div>

        <section className="card">
          {items.length === 0 ? (
            <p className="muted-text">저장된 요약이 없습니다.</p>
          ) : (
            <ul className="archive-list">
              {items.map((it) => {
                const thumb = it.thumbnail
                  ? it.thumbnail.startsWith("http")
                    ? it.thumbnail
                    : `${SITE_URL}${it.thumbnail}`
                  : "";

                const oneLine = (it.summary_ko || it.summary || it.title || "")
                  .replace(/\s+/g, " ")
                  .slice(0, 90);

                return (
                  <li key={it.id} className="archive-item">
                    <Link
                      href={`/archive/${encodeURIComponent(it.id)}`}
                      className="archive-link"
                    >
                      {thumb && (
                        <img
                          src={thumb}
                          alt={it.title || "thumbnail"}
                          className="archive-thumb"
                          loading="lazy"
                        />
                      )}
                      <div className="archive-info">
                        <div className="archive-item-title">
                          {it.title || it.id}
                        </div>
                        <div className="archive-item-meta">
                          {it.source} · {it.date}
                        </div>
                        {oneLine && (
                          <div className="archive-item-summary">
                            {oneLine}…
                          </div>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
