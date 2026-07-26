// lib/collect.js — 대구 소식 후보 수집 (소스 통합)
//   1) Google 뉴스 RSS: 항상 사용 (키 불필요)
//   2) 네이버 검색 API: 인증 env 있을 때만 추가 (뉴스+블로그, 없으면 조용히 스킵)

import { searchGoogleNews } from "./gnews";
import { collectDaeguCandidates as collectNaver, DAEGU_QUERIES } from "./naver";
import { fetchDaeguCityNews, fetchTourApiFestivals } from "./official";

const hasNaverEnv = () =>
  (process.env.NAVER_APIHUB_KEY_ID && process.env.NAVER_APIHUB_KEY) ||
  (process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET);

export async function collectAllCandidates({ days = 3 } = {}) {
  const byLink = new Map();

  // Google 뉴스 (항상)
  for (const query of DAEGU_QUERIES) {
    try {
      const items = await searchGoogleNews(query, { days });
      for (const item of items) {
        if (item.link && !byLink.has(item.link)) byLink.set(item.link, item);
      }
    } catch (e) {
      console.error(`gnews error (${query}):`, e.message);
    }
  }

  // 공식 소스: 대구시청 RSS (항상) + TourAPI 행사데이터 (TOUR_API_KEY 있을 때만)
  try {
    for (const item of await fetchDaeguCityNews({ days })) {
      if (item.link && !byLink.has(item.link)) byLink.set(item.link, item);
    }
  } catch (e) {
    console.error("daegu city rss error:", e.message);
  }
  try {
    for (const item of await fetchTourApiFestivals()) {
      if (item.link && !byLink.has(item.link)) byLink.set(item.link, item);
    }
  } catch (e) {
    console.error("tourapi error:", e.message);
  }

  // 네이버 (env 있을 때만)
  if (hasNaverEnv()) {
    try {
      const items = await collectNaver({ days });
      for (const item of items) {
        if (item.link && !byLink.has(item.link)) byLink.set(item.link, item);
      }
    } catch (e) {
      console.error("naver collect error:", e.message);
    }
  }

  return [...byLink.values()].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}
