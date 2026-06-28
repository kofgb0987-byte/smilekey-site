// pages/sitemap.xml.js
import { listSummaryIds, getSummary } from "../lib/redis";

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

export async function getServerSideProps({ res }) {
  const today = new Date().toISOString().slice(0, 10);

  const ids = await listSummaryIds(200);

  // 각 아이템 날짜 (없으면 today)
  const items = await Promise.all(
    ids.map(async (id) => {
      try {
        const it = await getSummary(id);
        const rawDate = (it?.date || "").trim().slice(0, 10);
        const date = rawDate && !isNaN(new Date(rawDate)) ? rawDate : today;
        return { id, date };
      } catch {
        return { id, date: today };
      }
    })
  );

  const staticPages = [
    urlEntry({ loc: SITE_URL, lastmod: today, changefreq: "weekly", priority: "1.0" }),
    urlEntry({ loc: `${SITE_URL}/archive`, lastmod: today, changefreq: "daily", priority: "0.8" }),
    urlEntry({ loc: `${SITE_URL}/services/car-key`, lastmod: today, changefreq: "monthly", priority: "0.9" }),
    urlEntry({ loc: `${SITE_URL}/services/smart-key`, lastmod: today, changefreq: "monthly", priority: "0.9" }),
    urlEntry({ loc: `${SITE_URL}/services/door-lock`, lastmod: today, changefreq: "monthly", priority: "0.9" }),
  ];

  const archivePages = items.map(({ id, date }) =>
    urlEntry({
      loc: `${SITE_URL}/archive/${encodeURIComponent(id)}`,
      lastmod: date,
      changefreq: "monthly",
      priority: "0.6",
    })
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPages.join("")}
${archivePages.join("")}
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
