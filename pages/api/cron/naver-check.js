// pages/api/cron/naver-check.js — 네이버 검색 API 연결 진단 + 임의 검색 (운영 도구)
// 호출: GET/POST /api/cron/naver-check, Authorization: Bearer {CRON_SECRET}
//   ?type=news|blog|local&q=검색어&display=n — 지역검색(local)으로 플레이스 등록/노출 확인용
// env 값 자체는 노출하지 않고 존재 여부/길이와 실호출 결과만 반환한다.
import { searchNaver, searchTrend } from "../../../lib/naver";

export default async function handler(req, res) {
  const auth = req.headers.authorization || "";
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const id = process.env.NAVER_APIHUB_KEY_ID || "";
  const key = process.env.NAVER_APIHUB_KEY || "";
  const env = {
    NAVER_APIHUB_KEY_ID: id ? `set(len=${id.length}${/\s/.test(id) ? ", 공백포함!" : ""})` : "없음",
    NAVER_APIHUB_KEY: key ? `set(len=${key.length}${/\s/.test(key) ? ", 공백포함!" : ""})` : "없음",
    NAVER_CLIENT_ID: process.env.NAVER_CLIENT_ID ? "set" : "없음",
  };

  const type = String(req.query.type || "news");
  const q = String(req.query.q || "대구");
  const display = Math.min(parseInt(req.query.display || "5", 10) || 5, 30);
  // 지역검색은 sort=date를 안 받음(random|comment만)
  const sort = String(req.query.sort || (type === "local" ? "random" : "date"));

  const authMode = req.query.auth === "legacy" ? "legacy" : undefined;

  let call = null;
  try {
    if (type === "trend") {
      // ?type=trend&q=키워드1,키워드2 (최대 5개) — 최근 90일 주간 상대 트렌드
      const endDate = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // KST 오늘
      const startDate = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
      const keywordGroups = q
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 5)
        .map((k) => ({ groupName: k, keywords: [k] }));
      const data = await searchTrend(keywordGroups, { startDate, endDate, auth: authMode });
      call = { ok: true, type, q, results: data.results };
    } else {
      const items = await searchNaver(type, q, { display, sort, auth: authMode });
      call = { ok: true, type, q, count: items.length, items };
    }
  } catch (e) {
    call = { ok: false, type, q, error: String(e.message || e).slice(0, 300) };
  }

  // 배포 확인용 마커 — 새 코드에만 있는 값으로 배포 성공을 판정한다(빌드 실패 배포를 구버전 응답이 가리는 사고 방지)
  return res.status(200).json({ ver: "2026-08-24-dedupfix", env, call });
}
