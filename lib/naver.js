// lib/naver.js — 네이버 검색 API (뉴스/블로그)
//
// ⚠️ 2026-07-31부로 구 개발자센터(openapi.naver.com)는 신규 앱 등록이 차단되고
//    2027-06-30에 지원 종료됨 → 신규 발급은 NAVER API HUB(NCP)로.
// 우선순위: NAVER_APIHUB_KEY_ID/NAVER_APIHUB_KEY(API HUB) → NAVER_CLIENT_ID/SECRET(구 개발자센터)
// 응답 items 필드(title/link/originallink/description/pubDate/postdate)는 양쪽 동일.

import { kstDay } from "./candidates";

const APIHUB_BASE = "https://naverapihub.apigw.ntruss.com/search/v1"; // + /news?query=..&format=json
const LEGACY_BASE = "https://openapi.naver.com/v1/search"; // + /news.json?query=..

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
  "대구 사건사고",
  "대구 경제",
  "대구 폭염",
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

// prefer="legacy"면 구 개발자센터 키 우선 — API HUB에 미구독인 검색타입(예: 지역)을 구 키로 시도할 때 사용
function getNaverAuth(prefer) {
  const hubId = process.env.NAVER_APIHUB_KEY_ID;
  const hubKey = process.env.NAVER_APIHUB_KEY;
  const id = process.env.NAVER_CLIENT_ID;
  const secret = process.env.NAVER_CLIENT_SECRET;

  const apihub = hubId && hubKey
    ? { mode: "apihub", headers: { "X-NCP-APIGW-API-KEY-ID": hubId, "X-NCP-APIGW-API-KEY": hubKey } }
    : null;
  const legacy = id && secret
    ? { mode: "legacy", headers: { "X-Naver-Client-Id": id, "X-Naver-Client-Secret": secret } }
    : null;

  const picked = prefer === "legacy" ? legacy || apihub : apihub || legacy;
  if (picked) return picked;
  throw new Error(
    "네이버 API 인증 env 없음 — NAVER_APIHUB_KEY_ID/NAVER_APIHUB_KEY(권장) 또는 NAVER_CLIENT_ID/NAVER_CLIENT_SECRET 필요"
  );
}

export async function searchNaver(type, query, { display = 15, sort = "date", auth } = {}) {
  const { mode, headers } = getNaverAuth(auth);

  const params = `query=${encodeURIComponent(query)}&display=${display}&sort=${sort}`;
  const url =
    mode === "apihub"
      ? `${APIHUB_BASE}/${type}?${params}&format=json`
      : `${LEGACY_BASE}/${type}.json?${params}`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  let res;
  try {
    res = await fetch(url, { headers, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
  if (!res.ok) {
    throw new Error(`naver ${type} search failed ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data.items || [];
}

// 데이터랩 검색어트렌드 — 검색 API와 달리 POST + JSON body, 상대값(기간 내 최대=100) 반환
// keywordGroups: [{groupName, keywords:[..]}] 최대 5개
const APIHUB_DATALAB = "https://naverapihub.apigw.ntruss.com/datalab/v1/search"; // 경로 미검증 — 404면 조정
const LEGACY_DATALAB = "https://openapi.naver.com/v1/datalab/search";

export async function searchTrend(keywordGroups, { startDate, endDate, timeUnit = "week", auth } = {}) {
  const { mode, headers } = getNaverAuth(auth);
  const url = mode === "apihub" ? APIHUB_DATALAB : LEGACY_DATALAB;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ startDate, endDate, timeUnit, keywordGroups }),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }
  if (!res.ok) {
    throw new Error(`naver datalab failed ${res.status}: ${await res.text()}`);
  }
  return res.json();
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
// 쿼리×타입 조합을 6개씩 병렬 실행 — 순차 22회 호출이 크론 타임아웃을 유발했던 것 방지
export async function collectDaeguCandidates({ days = 3, maxPerQuery = 15 } = {}) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const byLink = new Map();

  const jobs = [];
  for (const query of DAEGU_QUERIES) {
    for (const type of ["news", "blog"]) {
      jobs.push({ query, type });
    }
  }

  const CHUNK = 6;
  for (let i = 0; i < jobs.length; i += CHUNK) {
    const results = await Promise.all(
      jobs.slice(i, i + CHUNK).map(async ({ query, type }) => {
        try {
          return { type, query, items: await searchNaver(type, query, { display: maxPerQuery }) };
        } catch (e) {
          // 한 쿼리 실패가 전체 수집을 죽이지 않게
          console.error(`naver search error (${type}/${query}):`, e.message);
          return { type, query, items: [] };
        }
      })
    );

    for (const { type, query, items } of results) {
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
          // KST 일자 — UTC로 자르면 블로그(KST 자정)·저녁 기사가 전날로 밀려 최신순에서 손해
          date: date ? kstDay(date) : "",
        });
      }
    }
  }

  // 최신순
  return [...byLink.values()].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}
