// pages/sitemap.xml.js
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

  // 검색 색인 대상은 고유 콘텐츠 페이지로 한정.
  // /archive/* 는 본인 블로그·유튜브와 중복이라 noindex 처리 → sitemap에서 제외.
  const pages = [
    urlEntry({ loc: SITE_URL, lastmod: today, changefreq: "weekly", priority: "1.0" }),
    urlEntry({ loc: `${SITE_URL}/services/car-key`, lastmod: today, changefreq: "monthly", priority: "0.9" }),
    urlEntry({ loc: `${SITE_URL}/services/smart-key`, lastmod: today, changefreq: "monthly", priority: "0.9" }),
    urlEntry({ loc: `${SITE_URL}/services/door-lock`, lastmod: today, changefreq: "monthly", priority: "0.9" }),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.join("")}
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
