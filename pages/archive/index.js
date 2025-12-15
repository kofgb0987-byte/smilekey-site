// pages/archive/index.js

import Link from "next/link";
import { listSummaryIds, getSummary } from "../../lib/redis";

export async function getServerSideProps() {
  const ids = await listSummaryIds(50);

  const itemsRaw = await Promise.all(
    ids.map(async (id) => {
      const it = await getSummary(id);
      return it ? { ...it, id } : null;
    })
  );

  const items = itemsRaw.filter(Boolean);

  return { props: { items } };
}


export default function ArchiveList({ items }) {
  return (
    <main className="container">
      <header className="header">
        <h1 className="header-title">요약 저장소</h1>
        <p className="header-sub">유튜브/블로그 요약 아카이브</p>
      </header>

      <section className="card">
        {items.length === 0 ? (
          <p>저장된 요약이 없습니다.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
  {items.map((it) => {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://smilekey.me";
    const thumb = it.thumbnail
      ? (it.thumbnail.startsWith("http") ? it.thumbnail : `${siteUrl}${it.thumbnail}`)
      : "";

    const oneLine = (it.summary || it.title || "")
      .replace(/\s+/g, " ")
      .slice(0, 90);

    return (
      <li key={it.id} style={{ marginBottom: 12 }}>
        <a
          href={`/archive/${encodeURIComponent(it.id)}`}
          style={{
            display: "flex",
            gap: 12,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          {thumb ? (
            <img
              src={thumb}
              alt={it.title || "thumbnail"}
              style={{
                width: 88,
                height: 66,
                objectFit: "cover",
                borderRadius: 10,
                flex: "0 0 auto",
              }}
              loading="lazy"
            />
          ) : null}

          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, lineHeight: 1.25 }}>
              {it.title || it.id}
            </div>

            <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
              {it.source} · {it.date}
            </div>

            {oneLine ? (
              <div style={{ fontSize: 14, marginTop: 6, opacity: 0.9 }}>
                {oneLine}…
              </div>
            ) : null}
          </div>
        </a>
      </li>
    );
  })}
</ul>

        )}
      </section>
    </main>
  );
}

