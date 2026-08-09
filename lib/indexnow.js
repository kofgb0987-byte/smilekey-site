// lib/indexnow.js — 발행/갱신된 URL을 검색엔진에 즉시 통지 (IndexNow 프로토콜)
// 네이버(서치어드바이저)·빙 등이 지원. 키 파일은 public/{KEY}.txt로 호스팅됨.
// 실패해도 발행 흐름을 막지 않는 best-effort.
const KEY = "7f9e9f31179a2c39e75c4f999d110792";
const HOST = "smilekey.me";

const ENDPOINTS = [
  "https://searchadvisor.naver.com/indexnow", // 네이버 직통
  "https://api.indexnow.org/indexnow", // 공용 (참여 엔진 전체 공유)
];

export async function pingIndexNow(urls = []) {
  const urlList = urls.filter(Boolean).slice(0, 100);
  if (!urlList.length) return [];

  const body = JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: `https://${HOST}/${KEY}.txt`,
    urlList,
  });

  const results = [];
  for (const endpoint of ENDPOINTS) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body,
        signal: ctrl.signal,
      });
      results.push(`${new URL(endpoint).hostname}:${res.status}`);
    } catch (e) {
      results.push(`${new URL(endpoint).hostname}:ERR`);
      console.error(`indexnow ping error (${endpoint}):`, e.message);
    } finally {
      clearTimeout(t);
    }
  }
  return results;
}
