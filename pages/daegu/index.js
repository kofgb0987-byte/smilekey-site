// pages/daegu/index.js — 대구 소식 목록
import Head from "next/head";
import Link from "next/link";
import {
  listDaeguIds,
  getDaeguPost,
  getDaeguViewMap,
  getDaeguLikeMap,
  getDaeguCommentCountMap,
  topDaeguViewIdsWeekly,
  getDaeguWeeklyViewMap,
} from "../../lib/redis";

// 🔥 핫지수 — 최근 7일 조회수(일별 버킷, 8일 TTL)를 목록 안에서 상대평가.
//   전부에 불을 붙이면 변별력이 없어서 목록 상위 HOT_MAX개(주간 2회 이상)만 뱃지,
//   세기는 1위 대비 비율(70%↑ 3, 35%↑ 2)과 절대 횟수(10회↑ 3, 5회↑ 2) 중 낮은 쪽 —
//   전부 2회로 동점인 날 다섯 개가 다 🔥🔥🔥가 되는 것 방지.
const HOT_MAX = 5;
const HOT_MIN_VIEWS = 2;
function buildHotMap(items, weeklyMap) {
  const ranked = items
    .map((it) => ({ id: it.id, views: weeklyMap[it.id] || 0 }))
    .filter((x) => x.views >= HOT_MIN_VIEWS)
    .sort((a, b) => b.views - a.views)
    .slice(0, HOT_MAX);
  if (!ranked.length) return {};
  const max = ranked[0].views;
  const hot = {};
  for (const { id, views } of ranked) {
    const r = views / max;
    const byRatio = r >= 0.7 ? 3 : r >= 0.35 ? 2 : 1;
    const byAbs = views >= 10 ? 3 : views >= 5 ? 2 : 1;
    hot[id] = { views, level: Math.min(byRatio, byAbs) };
  }
  return hot;
}

function hotBadge(hot) {
  if (!hot) return null;
  const { views: weekly, level } = hot;
  const palette = {
    1: { bg: "rgba(255,140,0,0.12)", fg: "#b35a00" },
    2: { bg: "rgba(255,90,0,0.16)", fg: "#a63a00" },
    3: { bg: "rgba(230,30,0,0.18)", fg: "#8f1400" },
  }[level];
  return (
    <span
      title={`최근 7일 조회 ${weekly}회`}
      style={{
        display: "inline-block",
        marginLeft: 8,
        padding: "1px 7px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        lineHeight: "18px",
        verticalAlign: "middle",
        whiteSpace: "nowrap",
        background: palette.bg,
        color: palette.fg,
      }}
    >
      {"🔥".repeat(level)} {weekly}
    </span>
  );
}

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
  const commentMap = await getDaeguCommentCountMap(items.map((it) => it.id));
  const byId = new Map(items.map((it) => [it.id, it]));
  // 주간 상위 글은 최신 50개 목록 밖의 옛 글인 경우가 대부분(네이버 유입 글이 8~9월 글)이라
  // 목록으로 거르지 말고 글을 직접 읽는다. 2026-10-23까지는 전부 걸러져 섹션이 늘 비어 있었다.
  const weeklyMap = await getDaeguWeeklyViewMap(7); // 목록 전체 핫지수 + 인기글 후보 공용
  const candidates = await topDaeguViewIdsWeekly(10, 7, weeklyMap);
  const popularRaw = await Promise.all(
    candidates.map(async ({ id, views }) => {
      const post = byId.get(id) || (await getDaeguPost(id));
      if (!post || !post.title) return null; // 삭제된 글은 제외
      return {
        id,
        views,
        title: post.title,
        date: post.date || "", // 인기글도 목록처럼 발행일이 보이게
        likes: likeMap[id] ?? (await getDaeguLikeMap([id]))[id] ?? 0,
      };
    })
  );
  const popular = popularRaw.filter(Boolean).slice(0, 3);

  return {
    props: { items, viewMap, likeMap, commentMap, popular, hotMap: buildHotMap(items, weeklyMap) },
    revalidate: 3600, // 2026-10-23: 600→3600. 새 글은 finalizePost 가 즉시 revalidate
  };
}

// 목록을 월 단위로 묶는다 — 리스트가 길어져도 시기별로 훑기 좋게
function groupByMonth(items) {
  const groups = [];
  let cur = null;
  for (const it of items) {
    const ym = (it.date || "").slice(0, 7); // "2026-08"
    if (!cur || cur.ym !== ym) {
      cur = { ym, items: [] };
      groups.push(cur);
    }
    cur.items.push(it);
  }
  return groups;
}

function monthLabel(ym) {
  const [y, m] = ym.split("-");
  return y && m ? `${y}년 ${parseInt(m, 10)}월` : "날짜 미상";
}

export default function DaeguList({
  items,
  viewMap = {},
  likeMap = {},
  commentMap = {},
  popular = [],
  hotMap = {},
}) {
  // 목록 구조화 데이터(ItemList) — 서버 렌더 시점의 글 목록을 AI 검색엔진이 한 번에 훑도록
  const itemListJsonLd = items.length
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "대구 소식",
        url: `${SITE_URL}/daegu`,
        numberOfItems: items.length,
        itemListElement: items.map((it, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: it.title,
          url: `${SITE_URL}/daegu/${encodeURIComponent(it.id)}`,
        })),
      }
    : null;

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
        {itemListJsonLd && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd).replace(/</g, "\\u003c") }}
          />
        )}
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
                    <span style={{ fontWeight: 600 }}>{p.title}</span>
                    <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
                      {p.date}
                      {` · 조회 ${p.views}`}
                      {p.likes ? ` · ♥ ${p.likes}` : ""}
                    </div>
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
            groupByMonth(items).map((group) => (
            <div key={group.ym}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 14,
                  opacity: 0.65,
                  padding: "16px 0 4px",
                  borderBottom: "2px solid rgba(0,0,0,0.15)",
                }}
              >
                📅 {monthLabel(group.ym)}
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {group.items.map((it) => (
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
                      <div style={{ fontWeight: 700, fontSize: 16 }}>
                        {it.title}
                        {hotBadge(hotMap[it.id])}
                      </div>
                      {it.hook ? (
                        <div style={{ marginTop: 4, fontSize: 14, opacity: 0.85 }}>{it.hook}</div>
                      ) : null}
                      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.6 }}>
                        {it.date}
                        {viewMap[it.id] ? ` · 조회 ${viewMap[it.id]}` : ""}
                        {likeMap[it.id] ? ` · ♥ ${likeMap[it.id]}` : ""}
                        {commentMap[it.id] ? ` · 💬 ${commentMap[it.id]}` : ""}
                        {Array.isArray(it.tags) && it.tags.length
                          ? ` · ${it.tags.slice(0, 4).map((t) => `#${t}`).join(" ")}`
                          : ""}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
              </ul>
            </div>
            ))
          )}
        </section>
      </main>
    </>
  );
}
