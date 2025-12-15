//pages/sitemap.xml.js
import { listSummaryIds } from "../lib/redis";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://smilekey.me";

export async function getServerSideProps({ res }) {
  const ids = await listSummaryIds(200); // 원하는 만큼

  const urls = ids
    .map((id) => `${siteUrl}/archive/${encodeURIComponent(id)}`)
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/</loc>
  </url>
  <url>
    <loc>${siteUrl}/archive</loc>
  </url>
  ${ids
    .map(
      (id) => `
  <url>
    <loc>${siteUrl}/archive/${encodeURIComponent(id)}</loc>
  </url>`
    )
    .join("")}
</urlset>`;

  res.setHeader("Content-Type", "text/xml");
  res.write(xml);
  res.end();

  return { props: {} };
}

export default function SiteMap() {
  return null;
}
