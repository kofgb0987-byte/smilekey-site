// pages/sitemap.xml.js — Redis에 저장된 사이트맵을 GET 1번으로 내보낸다(생성 로직은 lib/sitemap.js).
// 2026-10-23: 요청마다 600여 번 Redis를 읽던 것을 크론·발행 시 1회 생성으로 바꿈. 캐시가 비어 있으면 즉석 생성 후 저장.
import { getCachedSitemap, rebuildSitemap } from "../lib/sitemap";

export async function getServerSideProps({ res }) {
  let xml = await getCachedSitemap();
  let source = "redis";
  if (!xml) {
    xml = await rebuildSitemap();
    source = "built";
  }

  res.setHeader("Content-Type", "text/xml");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.setHeader("x-sitemap-source", source); // 검증용: redis | built
  res.write(xml);
  res.end();

  return { props: {} };
}

export default function SiteMap() {
  return null;
}
