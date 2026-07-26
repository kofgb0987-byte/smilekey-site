// pages/daegu/[id].js — 대구 소식 상세
import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import { listDaeguIds, getDaeguPost } from "../../lib/redis";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://smilekey.me";
const PHONE = "010-3503-6919";
// 🔒 품질 검증 기간 동안 noindex 유지 (index.js와 함께 전환)
const INDEXABLE = false;

export async function getStaticPaths() {
  try {
    const ids = await listDaeguIds(30);
    return { paths: ids.map((id) => ({ params: { id } })), fallback: "blocking" };
  } catch {
    return { paths: [], fallback: "blocking" };
  }
}

export async function getStaticProps({ params }) {
  try {
    const item = await getDaeguPost(params.id);
    if (!item || !item.title) return { notFound: true };
    return { props: { item: { ...item, id: params.id } }, revalidate: 3600 };
  } catch {
    return { notFound: true };
  }
}

export default function DaeguDetail({ item }) {
  const [views, setViews] = useState(null);

  // 조회수: 세션 최초 1회만 +1, 재방문은 읽기만
  useEffect(() => {
    const key = `daegu-viewed-${item.id}`;
    let seen = false;
    try {
      seen = !!sessionStorage.getItem(key);
    } catch {}
    fetch(`/api/daegu/view?id=${encodeURIComponent(item.id)}`, {
      method: seen ? "GET" : "POST",
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok) setViews(d.views);
        try {
          sessionStorage.setItem(key, "1");
        } catch {}
      })
      .catch(() => {});
  }, [item.id]);

  const canonical = `${SITE_URL}/daegu/${encodeURIComponent(item.id)}`;
  const desc = (item.hook || item.title).slice(0, 155);
  const sections = Array.isArray(item.sections) ? item.sections : [];
  const tags = Array.isArray(item.tags) ? item.tags : [];
  const sources = Array.isArray(item.sources) ? item.sources : [];

  return (
    <>
      <Head>
        <title>{`${item.title} | 대구 소식`}</title>
        <meta name="description" content={desc} />
        {!INDEXABLE && <meta name="robots" content="noindex,follow" />}
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={item.title} />
        <meta property="og:description" content={desc} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="article" />
      </Head>

      <main className="container">
        <div style={{ margin: "12px 0", display: "flex", gap: 14 }}>
          <Link href="/daegu" style={{ fontSize: 13, opacity: 0.75 }}>
            ← 대구 소식
          </Link>
          <Link href="/" style={{ fontSize: 13, opacity: 0.75 }}>
            홈
          </Link>
        </div>

        <article className="card">
          <h1 style={{ marginTop: 0, fontSize: 22, lineHeight: 1.35 }}>{item.title}</h1>
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 14 }}>
            {item.date}
            {views !== null ? ` · 조회 ${views}` : ""}
          </div>

          {item.hook ? (
            <p style={{ fontSize: 15, fontWeight: 500, opacity: 0.9 }}>{item.hook}</p>
          ) : null}

          {sections.map((s, i) => (
            <section key={i} style={{ marginTop: 18 }}>
              <h2 style={{ fontSize: 17, marginBottom: 6 }}>{s.heading}</h2>
              <p style={{ margin: 0, lineHeight: 1.7 }}>{s.body}</p>
            </section>
          ))}

          {tags.length ? (
            <div style={{ marginTop: 18, fontSize: 13, opacity: 0.7 }}>
              {tags.map((t) => `#${t}`).join(" ")}
            </div>
          ) : null}

          {sources.length ? (
            <div style={{ marginTop: 18, paddingTop: 12, borderTop: "1px solid rgba(0,0,0,0.08)" }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>참고한 소식</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                {sources.map((s, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    <a href={s.link} target="_blank" rel="noreferrer nofollow">
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div
            style={{
              marginTop: 22,
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(0,0,0,0.04)",
              fontSize: 13,
              opacity: 0.85,
            }}
          >
            대구 소식은 동구 검사동 <strong>중앙열쇠</strong>가 전해드려요. 자동차키·스마트키·도어락
            문의 <a href={`tel:${PHONE}`}>{PHONE}</a>
          </div>
        </article>
      </main>
    </>
  );
}
