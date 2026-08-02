// lib/og.js — 기사 원문에서 대표 이미지(og:image) 추출 (발행 시 best-effort)
// Google 뉴스 리다이렉트 링크는 JS 전용이라 불가 — 직접 기사 URL(네이버 originallink 등)에만 사용.
export async function fetchOgImage(pageUrl, { timeoutMs = 6000 } = {}) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(pageUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; smilekey-bot)" },
      redirect: "follow",
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return "";
    if (!(res.headers.get("content-type") || "").includes("html")) return "";

    const html = (await res.text()).slice(0, 400000);
    const m =
      html.match(/<meta[^>]+(?:property|name)=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']og:image(?::secure_url)?["']/i);
    if (!m) return "";

    let img = m[1].replace(/&amp;/g, "&").trim();
    try {
      img = new URL(img, res.url || pageUrl).toString(); // 상대경로·//호스트 보정
    } catch {
      return "";
    }
    return /^https?:\/\//.test(img) ? img : "";
  } catch {
    return "";
  }
}
