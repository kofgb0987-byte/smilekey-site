// lib/guide.js — 안내 가이드 서버 헬퍼
//   getRecentCases(match, n): 작업 아카이브에서 주제 정규식에 맞는 최신 사례 n건 (페이지 ISR로 매일 갱신)
//   findGuideForTitle(title): 작업 사례 제목에 맞는 가이드 1개 (사례 글 → 가이드 링크용)
// 가이드 본문은 content/guide/posts.json(정적, 커밋됨)이고 여기서는 Redis만 다룬다.

import { redis } from "./redis";
import topicsFile from "../content/guide/topics.json";
import guideIndex from "../content/guide/index.json";

const LIST_KEY = "smilekey:summaries:v1";
const key = (id) => `smilekey:summary:${id}`;
const parseDate = (d) => { const t = Date.parse(String(d || "")); return isNaN(t) ? "" : new Date(t).toISOString().slice(0, 10); };
const caseText = (row) => `${row.title || ""} ${row.summary_ko || ""}`;

function rowToCase(id, row) {
  return {
    id,
    title: String(row.title || "").trim(),
    date: parseDate(row.date),
    summary: String(row.summary_ko || row.summary || "").trim(),
    thumbnail: String(row.thumbnail || ""),
  };
}

// 최신 목록 앞쪽(scan건)만 훑는다 — 가이드는 "최근" 사례가 목적이라 전량 조회 불필요.
// 파이프라인 1회에 100건씩. 실패하면 빈 배열로 내려가 페이지 빌드를 막지 않는다.
export async function getRecentCases(match, n = 6, scan = 300) {
  if (!match) return [];
  let re;
  try { re = new RegExp(match, "i"); } catch { return []; }
  try {
    const ids = (await redis.lrange(LIST_KEY, 0, scan - 1)) || [];
    const out = [];
    for (let i = 0; i < ids.length && out.length < n; i += 100) {
      const chunk = ids.slice(i, i + 100);
      let rows;
      try {
        const p = redis.pipeline();
        chunk.forEach((id) => p.hgetall(key(id)));
        rows = await p.exec();
      } catch (e) {
        console.error("getRecentCases pipeline 실패, 순차 폴백:", e.message);
        rows = [];
        for (const id of chunk.slice(0, 40)) rows.push(await redis.hgetall(key(id)));
      }
      rows.forEach((row, j) => {
        if (row && row.title && re.test(caseText(row))) out.push(rowToCase(chunk[j], row));
      });
    }
    return out.slice(0, n);
  } catch (e) {
    console.error("getRecentCases error:", e.message);
    return [];
  }
}

// 작업 사례 제목 → 가이드. 차종 가이드를 먼저, 그다음 키 종류·상황. 생성된 가이드(index.json)만 대상.
const GROUP_ORDER = { 차종: 0, "키 종류": 1, 상황: 2 };
export function findGuideForTitle(title) {
  if (!title) return null;
  const published = new Set(guideIndex.map((g) => g.slug));
  const topics = topicsFile.topics
    .filter((t) => published.has(t.slug))
    .sort((a, b) => (GROUP_ORDER[a.group] ?? 9) - (GROUP_ORDER[b.group] ?? 9));
  for (const t of topics) {
    try {
      if (new RegExp(t.match, "i").test(title)) {
        const g = guideIndex.find((x) => x.slug === t.slug);
        return g ? { slug: g.slug, name: g.name, title: g.title } : null;
      }
    } catch { /* 잘못된 정규식은 건너뜀 */ }
  }
  return null;
}

export function topicBySlug(slug) {
  return topicsFile.topics.find((t) => t.slug === slug) || null;
}
