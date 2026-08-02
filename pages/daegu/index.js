// pages/daegu/index.js — 대구 소식 목록
import Head from "next/head";
import Link from "next/link";
import {
  listDaeguIds,
  getDaeguPost,
  getDaeguViewMap,
  getDaeguLikeMap,
  topDaeguViewIdsWeekly,
} from "../../lib/redis";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://smilekey.me";
// 🔒 품질 검증 기간 동안 noindex 유지. 콘텐츠 품질 확인 후 true로 바꾸고 sitemap에도 추가할 것.
const INDEXABLE = true;

export async function getStaticProps() {
  const ids = await listDaeguIds(50);

  const itemsRaw = await Promise.all(
    ids.map(async (id) => {
      const it = await getDaeguPost(id);
      return it && it.title ? { ...it, id } : null;
    })
  );
  const items = itemsRaw.filter(Boolean);

  // 조회수/좋아요 + 인기글(최근 7일 조회 상위 3, 조회 0 제외)
  const viewMap = await getDaeguViewMap(items.map((it) => it.id));
  const likeMap = await getDaeguLikeMap(items.map((it) => it.id));
  const byId = new Map(items.map((it) => [it.id, it]));
  const popular = (await topDaeguViewIdsWeekly(3))
    .filter(({ id }) => byId.has(id))
    .map(({ id, views }) => ({ id, views, title: byId.get(id).title }));

  return {
    props: { items, viewMap, likeMap, popular },
    revalidate: 600,
  };
}

export default function DaeguList({ items, viewMap = {}, likeMap = {}, popular = [] }) {
  return (
    <>
      <Head>
        <title>대구 소식 | 대구 중앙열쇠</title>
        <meta
          name="description"
          content="대구·동구·경상권 축제, 행사, 지역 이슈, 핫플레이스 소식을 하루 두 번 전합니다."
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
          <p className="header-sub">축제·행사·지역 이슈·핫플 — 대구의 지금 이야기</p>
        </header>

        <div style={{ marginBottom: 12, display: "flex", gap: 14 }}>
          <Link href="/" style={{ fontSize: 13, opacity: 0.75 }}>
            ← 홈으로
          </Link>
          <Link href="/archive" style={{ fontSize: 13, opacity: 0.75 }}>
            작업 아카이브
          </Link>
        </div>

        {popular.length > 0 && (
          <section className="card" style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>🔥 주간 인기글</div>
            <ol style={{ margin: 0, paddingLeft: 22 }}>
              {popular.map((p) => (
                <li key={p.id} style={{ marginBottom: 6 }}>
                  <Link
                    href={`/daegu/${encodeURIComponent(p.id)}`}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    {p.title}
                    <span style={{ fontSize: 12, opacity: 0.6 }}> · 조회 {p.views}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}

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
                    style={{ textDecoration: "none", color: "inherit", display: "flex", gap: 12 }}
                  >
                    {it.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.thumbnail}
                        alt=""
                        loading="lazy"
                        style={{
                          width: 64,
                          height: 64,
                          objectFit: "cover",
                          borderRadius: 8,
                          flexShrink: 0,
                        }}
                      />
                    ) : null}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{it.title}</div>
                      {it.hook ? (
                        <div style={{ marginTop: 4, fontSize: 14, opacity: 0.85 }}>{it.hook}</div>
                      ) : null}
                      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.6 }}>
                        {it.date}
                        {viewMap[it.id] ? ` · 조회 ${viewMap[it.id]}` : ""}
                        {likeMap[it.id] ? ` · ♥ ${likeMap[it.id]}` : ""}
                        {Array.isArray(it.tags) && it.tags.length
                          ? ` · ${it.tags.slice(0, 4).map((t) => `#${t}`).join(" ")}`
                          : ""}
                      </div>
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
