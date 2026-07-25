// lib/naver.js — 네이버 오픈API 검색 (뉴스/블로그)
// 필요 env: NAVER_CLIENT_ID, NAVER_CLIENT_SECRET (https://developers.naver.com 앱 등록)

const API_BASE = "https://openapi.naver.com/v1/search";

// 수집 쿼리 — 대구/동구/경상권 축제·행사·이슈·트렌드
export const DAEGU_QUERIES = [
  "대구 축제",
  "대구 동구 행사",
  "대구 행사 일정",
  "대구 핫플레이스",
  "대구 이슈",
  "대구 전시 공연",
  "경북 축제",
  "대구 유행",
];

function stripTags(s = "") {
  return String(s)
    .replace(/<\/?b>/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function searchNaver(type, query, { display = 15, sort = "date" } = {}) {
  const id = process.env.NAVER_CLIENT_ID;
  const secret = process.env.NAVER_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("NAVER_CLIENT_ID / NAVER_CLIENT_SECRET env가 없습니다.");
  }

  const url = `${API_BASE}/${type}.json?query=${encodeURIComponent(query)}&display=${display}&sort=${sort}`;
  const res = await fetch(url, {
    headers: { "X-Naver-Client-Id": id, "X-Naver-Client-Secret": secret },
  });
  if (!res.ok) {
    throw new Error(`naver ${type} search failed ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data.items || [];
}

// 뉴스 pubDate: "Fri, 25 Jul 2026 10:00:00 +0900" / 블로그 postdate: "20260725"
function parseItemDate(item) {
  if (item.pubDate) {
    const d = new Date(item.pubDate);
    if (!isNaN(d)) return d;
  }
  if (item.postdate && /^\d{8}$/.test(item.postdate)) {
    return new Date(
      `${item.postdate.slice(0, 4)}-${item.postdate.slice(4, 6)}-${item.postdate.slice(6, 8)}T00:00:00+09:00`
    );
  }
  return null;
}

// 전체 쿼리를 돌며 최근 N일 이내 후보를 모아 링크 기준 dedup
export async function collectDaeguCandidates({ days = 3, maxPerQuery = 15 } = {}) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const byLink = new Map();

  for (const query of DAEGU_QUERIES) {
    for (const type of ["news", "blog"]) {
      let items = [];
      try {
        items = await searchNaver(type, query, { display: maxPerQuery });
      } catch (e) {
        // 한 쿼리 실패가 전체 수집을 죽이지 않게
        console.error(`naver search error (${type}/${query}):`, e.message);
        continue;
      }

      for (const item of items) {
        const link = (item.originallink || item.link || "").trim();
        if (!link || byLink.has(link)) continue;

        const date = parseItemDate(item);
        if (date && date.getTime() < cutoff) continue;

        byLink.set(link, {
          type,
          query,
          title: stripTags(item.title),
          description: stripTags(item.description),
          link,
          date: date ? date.toISOString().slice(0, 10) : "",
        });
      }
    }
  }

  // 최신순
  return [...byLink.values()].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}
