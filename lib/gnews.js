// lib/gnews.js — Google 뉴스 RSS 검색 (가입/키 불필요)
// https://news.google.com/rss/search?q=대구+축제+when:3d&hl=ko&gl=KR&ceid=KR:ko

import { XMLParser } from "fast-xml-parser";

function stripTags(s = "") {
  return String(s)
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export async function searchGoogleNews(query, { days = 3, max = 15 } = {}) {
  const q = encodeURIComponent(`${query} when:${days}d`);
  const url = `https://news.google.com/rss/search?q=${q}&hl=ko&gl=KR&ceid=KR:ko`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000); // 응답 지연이 전체 수집을 멈추지 않게
  let res;
  try {
    res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
  if (!res.ok) throw new Error(`google news rss failed ${res.status}`);

  const parser = new XMLParser({ ignoreAttributes: false });
  const data = parser.parse(await res.text());

  const raw = data.rss?.channel?.item;
  const items = raw ? (Array.isArray(raw) ? raw : [raw]) : [];

  return items.slice(0, max).map((item) => {
    const d = item.pubDate ? new Date(item.pubDate) : null;
    // source 태그(언론사명): {"#text": "매일신문", "@_url": ...} 형태
    const press =
      typeof item.source === "object" ? item.source["#text"] : item.source || "";
    return {
      type: "news",
      query,
      title: stripTags(item.title),
      // description은 기사목록 HTML이라 정보가 적음 — 제목+언론사 위주로 사용
      description: [press, stripTags(item.description || "")].filter(Boolean).join(" — ").slice(0, 300),
      link: (item.link || "").trim(),
      date: d && !isNaN(d) ? d.toISOString().slice(0, 10) : "",
    };
  });
}
