// lib/sitemap.js — 사이트맵 XML 생성·Redis 캐시 (2026-10-23)
// 전에는 /sitemap.xml 요청마다 Redis를 600여 번(요약·대구소식 전부 hgetall) 읽어 만들었다.
// 이제 ① 21:00 UTC 크론(sync-summaries) 끝에 ② 대구소식 발행·삭제 직후 한 번 만들어 Redis 문자열 키에 저장하고,
// 요청 시엔 GET 1번만 한다. 키가 비어 있으면(최초·유실) 그 자리에서 만들어 채운다.
import { redis, listAllSummaryIds, getSummary, listAllDaeguIds, getDaeguPost } from "./redis";
import guideIndex from "../content/guide/index.json";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://smilekey.me";
export const SITEMAP_KEY = "smilekey:sitemap:xml:v1";
const SITEMAP_AT_KEY = "smilekey:sitemap:at:v1";

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

async function datedItems(ids, getter, today) {
  const rows = await Promise.all(
    ids.map(async (id) => {
      try {
        const it = await getter(id);
        if (!it || !Object.keys(it).length) return null; // 상세 해시가 삭제된 글은 제외
        return { id, date: toDay(it.date) || today };
      } catch {
        return { id, date: today };
      }
    })
  );
  return rows.filter(Boolean).sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** Redis를 전부 읽어 사이트맵 XML 문자열을 만든다(저장은 안 함). */
export async function buildSitemapXml() {
  const today = new Date().toISOString().slice(0, 10);

  // 목록 list가 아니라 중복방지 set 기준 — list는 ltrim으로 잘려서 옛 글이 사이트맵에서 누락됐었음
  const items = await datedItems(await listAllSummaryIds(), getSummary, today);
  const daeguItems = await datedItems(await listAllDaeguIds(), getDaeguPost, today);

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
    urlEntry({ loc: `${SITE_URL}/archive/${encodeURIComponent(id)}`, lastmod: date, changefreq: "monthly", priority: "0.6" })
  );
  const daeguPages = daeguItems.map(({ id, date }) =>
    urlEntry({ loc: `${SITE_URL}/daegu/${encodeURIComponent(id)}`, lastmod: date, changefreq: "monthly", priority: "0.6" })
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPages.join("")}
${guidePages.join("")}
${archivePages.join("")}
${daeguPages.join("")}
</urlset>`;
}

/** 만들어서 Redis에 저장하고 XML을 돌려준다. 크론·발행·삭제 뒤에 호출. */
export async function rebuildSitemap() {
  const xml = await buildSitemapXml();
  await redis.set(SITEMAP_KEY, xml);
  await redis.set(SITEMAP_AT_KEY, new Date().toISOString());
  return xml;
}

/** 저장된 XML(없으면 null). @upstash/redis 의 get 은 JSON 파싱을 시도하지만 "<?xml" 은 JSON이 아니라 문자열 그대로 온다. */
export async function getCachedSitemap() {
  const v = await redis.get(SITEMAP_KEY);
  return typeof v === "string" && v.startsWith("<?xml") ? v : null;
}

/** 실패해도 호출자를 깨지 않는 재생성 — 발행·삭제 흐름에서 쓴다. */
export async function rebuildSitemapSafe(label = "") {
  try {
    await rebuildSitemap();
    return true;
  } catch (e) {
    console.error(`sitemap rebuild error${label ? ` (${label})` : ""}:`, e);
    return false;
  }
}
