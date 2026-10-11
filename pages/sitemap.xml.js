// pages/sitemap.xml.js
import { listAllSummaryIds, getSummary, listAllDaeguIds, getDaeguPost } from "../lib/redis";
import guideIndex from "../content/guide/index.json";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://smilekey.me";

function urlEntry({ loc, lastmod, changefreq, priority }) {
  return `
  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

// 저장된 date 는 RSS 형식("Thu, 15 Jan 2026")이 대부분이라 slice(0,10)으로 자르면 NaN → 293개 글이 전부 "오늘"로 나갔다(2026-10-11 수정).
// 전체 문자열을 Date 로 파싱해 YYYY-MM-DD 로 만들고, 정말 없을 때만 today.
function toDay(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (isNaN(d)) return "";
  // toISOString 은 UTC 로 바꿔 KST 자정 전후가 하루 밀린다 → 로컬 날짜 부품으로 조립
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function getServerSideProps({ res }) {
  const today = new Date().toISOString().slice(0, 10);

  // 목록 list가 아니라 중복방지 set 기준 — list는 ltrim으로 잘려서 옛 글이 사이트맵에서 누락됐었음
  const ids = await listAllSummaryIds();

  // 각 아이템 날짜 (없으면 today), 상세 해시가 삭제된 글은 제외
  const items = (
    await Promise.all(
      ids.map(async (id) => {
        try {
          const it = await getSummary(id);
          if (!it || !Object.keys(it).length) return null;
          const date = toDay(it.date) || today;
          return { id, date };
        } catch {
          return { id, date: today };
        }
      })
    )
  )
    .filter(Boolean)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  // 대구 소식 글
  const daeguIds = await listAllDaeguIds();
  const daeguItems = (
    await Promise.all(
      daeguIds.map(async (id) => {
        try {
          const it = await getDaeguPost(id);
          if (!it || !Object.keys(it).length) return null;
          const date = toDay(it.date) || today;
          return { id, date };
        } catch {
          return { id, date: today };
        }
      })
    )
  )
    .filter(Boolean)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const staticPages = [
    urlEntry({ loc: SITE_URL, lastmod: today, changefreq: "weekly", priority: "1.0" }),
    urlEntry({ loc: `${SITE_URL}/archive`, lastmod: today, changefreq: "daily", priority: "0.8" }),
    urlEntry({ loc: `${SITE_URL}/daegu`, lastmod: today, changefreq: "daily", priority: "0.8" }),
    urlEntry({ loc: `${SITE_URL}/services/car-key`, lastmod: today, changefreq: "monthly", priority: "0.9" }),
    urlEntry({ loc: `${SITE_URL}/services/smart-key`, lastmod: today, changefreq: "monthly", priority: "0.9" }),
    urlEntry({ loc: `${SITE_URL}/services/door-lock`, lastmod: today, changefreq: "monthly", priority: "0.9" }),
    ...(guideIndex.length
      ? [urlEntry({ loc: `${SITE_URL}/guide`, lastmod: today, changefreq: "weekly", priority: "0.8" })]
      : []),
  ];

  // 안내 가이드 — 정적 콘텐츠(커밋)라 Redis 조회 없음. lastmod는 생성 시각.
  const guidePages = guideIndex.map((g) =>
    urlEntry({
      loc: `${SITE_URL}/guide/${g.slug}`,
      lastmod: (g.generated_at || today).slice(0, 10),
      changefreq: "weekly",
      priority: "0.8",
    })
  );

  const archivePages = items.map(({ id, date }) =>
    urlEntry({
      loc: `${SITE_URL}/archive/${encodeURIComponent(id)}`,
      lastmod: date,
      changefreq: "monthly",
      priority: "0.6",
    })
  );

  const daeguPages = daeguItems.map(({ id, date }) =>
    urlEntry({
      loc: `${SITE_URL}/daegu/${encodeURIComponent(id)}`,
      lastmod: date,
      changefreq: "monthly",
      priority: "0.6",
    })
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPages.join("")}
${guidePages.join("")}
${archivePages.join("")}
${daeguPages.join("")}
</urlset>`;

  res.setHeader("Content-Type", "text/xml");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.write(xml);
  res.end();

  return { props: {} };
}

export default function SiteMap() {
  return null;
}
