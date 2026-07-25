// pages/daegu/index.js — 대구 소식 목록
import Head from "next/head";
import Link from "next/link";
import { listDaeguIds, getDaeguPost } from "../../lib/redis";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://smilekey.me";
// 🔒 품질 검증 기간 동안 noindex 유지. 콘텐츠 품질 확인 후 true로 바꾸고 sitemap에도 추가할 것.
const INDEXABLE = false;

export async function getStaticProps() {
  const ids = await listDaeguIds(50);

  const itemsRaw = await Promise.all(
    ids.map(async (id) => {
      const it = await getDaeguPost(id);
      return it && it.title ? { ...it, id } : null;
    })
  );

  return {
    props: { items: itemsRaw.filter(Boolean) },
    revalidate: 600,
  };
}

export default function DaeguList({ items }) {
  return (
    <>
      <Head>
        <title>대구 소식 | 대구 중앙열쇠</title>
        <meta
          name="description"
          content="대구·동구·경상권 축제, 행사, 핫플레이스 소식을 하루 두 번 전합니다."
        />
        {!INDEXABLE && <meta name="robots" content="noindex,follow" />}
        <link rel="canonical" href={`${SITE_URL}/daegu`} />
        <meta property="og:title" content="대구 소식 | 대구 중앙열쇠" />
        <meta property="og:url" content={`${SITE_URL}/daegu`} />
        <meta property="og:type" content="website" />
      </Head>

      <main className="container">
        <header className="header">
          <h1 className="header-title">대구 소식</h1>
          <p className="header-sub">축제·행사·핫플 — 대구의 재미있는 이야기</p>
        </header>

        <div style={{ marginBottom: 12, display: "flex", gap: 14 }}>
          <Link href="/" style={{ fontSize: 13, opacity: 0.75 }}>
            ← 홈으로
          </Link>
          <Link href="/archive" style={{ fontSize: 13, opacity: 0.75 }}>
            작업 아카이브
          </Link>
        </div>

        <section className="card">
          {items.length === 0 ? (
            <p className="muted-text">아직 소식이 없습니다. 곧 첫 소식이 올라와요!</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {items.map((it) => (
                <li
                  key={it.id}
                  style={{ padding: "14px 0", borderBottom: "1px solid rgba(0,0,0,0.08)" }}
                >
                  <Link
                    href={`/daegu/${encodeURIComponent(it.id)}`}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{it.title}</div>
                    {it.hook ? (
                      <div style={{ marginTop: 4, fontSize: 14, opacity: 0.85 }}>{it.hook}</div>
                    ) : null}
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.6 }}>
                      {it.date}
                      {Array.isArray(it.tags) && it.tags.length
                        ? ` · ${it.tags.slice(0, 4).map((t) => `#${t}`).join(" ")}`
                        : ""}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
