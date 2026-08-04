// lib/collect.js — 대구 소식 후보 수집 (소스 통합)
//   1) Google 뉴스 RSS: 항상 사용 (키 불필요)
//   2) 네이버 검색 API: 인증 env 있을 때만 추가 (뉴스+블로그, 없으면 조용히 스킵)

import { searchGoogleNews } from "./gnews";
import { collectDaeguCandidates as collectNaver, DAEGU_QUERIES } from "./naver";
import { fetchDaeguCityNews, fetchTourApiFestivals } from "./official";

const hasNaverEnv = () =>
  (process.env.NAVER_APIHUB_KEY_ID && process.env.NAVER_APIHUB_KEY) ||
  (process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET);

// 소스 그룹(gnews·공식·네이버)을 동시에 수집 — 순차 실행이 크론 타임아웃을 유발했던 것 방지
export async function collectAllCandidates({ days = 3 } = {}) {
  const byLink = new Map();
  const add = (items) => {
    for (const item of items) {
      if (item.link && !byLink.has(item.link)) byLink.set(item.link, item);
    }
  };

  const gnewsJob = Promise.all(
    DAEGU_QUERIES.map(async (query) => {
      try {
        return await searchGoogleNews(query, { days });
      } catch (e) {
        console.error(`gnews error (${query}):`, e.message);
        return [];
      }
    })
  ).then((r) => r.flat());

  const cityJob = fetchDaeguCityNews({ days }).catch((e) => {
    console.error("daegu city rss error:", e.message);
    return [];
  });
  const tourJob = fetchTourApiFestivals().catch((e) => {
    console.error("tourapi error:", e.message);
    return [];
  });
  const naverJob = hasNaverEnv()
    ? collectNaver({ days }).catch((e) => {
        console.error("naver collect error:", e.message);
        return [];
      })
    : Promise.resolve([]);

  const [gnewsItems, cityItems, tourItems, naverItems] = await Promise.all([
    gnewsJob,
    cityJob,
    tourJob,
    naverJob,
  ]);
  // 우선순위: gnews/공식이 먼저 등록되고 네이버는 새 링크만 추가 (기존 동작 유지)
  add(gnewsItems);
  add(cityItems);
  add(tourItems);
  add(naverItems);

  return [...byLink.values()].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}
