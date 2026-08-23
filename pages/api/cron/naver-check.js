// pages/api/cron/naver-check.js — 네이버 검색 API 연결 진단 + 임의 검색 (운영 도구)
// 호출: GET/POST /api/cron/naver-check, Authorization: Bearer {CRON_SECRET}
//   ?type=news|blog|local&q=검색어&display=n — 지역검색(local)으로 플레이스 등록/노출 확인용
// env 값 자체는 노출하지 않고 존재 여부/길이와 실호출 결과만 반환한다.
import { searchNaver } from "../../../lib/naver";

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

  let call = null;
  try {
    const items = await searchNaver(type, q, { display, sort });
    call = { ok: true, type, q, count: items.length, items };
  } catch (e) {
    call = { ok: false, type, q, error: String(e.message || e).slice(0, 300) };
  }

  return res.status(200).json({ env, call });
}
