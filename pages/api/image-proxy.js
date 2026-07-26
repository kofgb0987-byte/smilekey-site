// pages/api/image-proxy.js
// 허용 호스트만 중계 (오픈 프록시 악용 방지)
const ALLOWED_HOSTS = [
  /(^|\.)pstatic\.net$/i,        // 네이버 블로그 이미지
  /(^|\.)ytimg\.com$/i,          // 유튜브 썸네일
  /(^|\.)daegu\.go\.kr$/i,       // 대구시청 보도사진
  /(^|\.)visitkorea\.or\.kr$/i,  // 한국관광공사(TourAPI) 이미지
];

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    res.status(400).send("Missing url");
    return;
  }

  let targetUrl = url;

  // 👉 여기서 굳이 decode를 안 해도 되는데,
  // 혹시라도 깔끔하게 한 번만 시도하고, 에러 나면 그냥 raw 그대로 씀
  try {
    targetUrl = decodeURIComponent(url);
  } catch (e) {
    console.warn("decodeURIComponent failed, using raw url:", url);
    targetUrl = url;
  }

  try {
    const host = new URL(targetUrl).hostname;
    if (!ALLOWED_HOSTS.some((re) => re.test(host))) {
      res.status(403).send("Host not allowed");
      return;
    }
  } catch {
    res.status(400).send("Invalid url");
    return;
  }

  try {
    const response = await fetch(targetUrl);

    if (!response.ok) {
      res.status(response.status).end();
      return;
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = await response.arrayBuffer();

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400, immutable");

    res.status(200).send(Buffer.from(buffer));
  } catch (e) {
    console.error("image-proxy fetch error:", e);
    res.status(500).end();
  }
}
