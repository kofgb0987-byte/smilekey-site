// pages/api/cron/naver-check.js — 네이버 검색 API 연결 진단 (운영 도구)
// 호출: GET/POST /api/cron/naver-check, Authorization: Bearer {CRON_SECRET}
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

  let call = null;
  try {
    const items = await searchNaver("news", "대구", { display: 1 });
    call = { ok: true, items: items.length, sampleTitle: items[0]?.title || null };
  } catch (e) {
    call = { ok: false, error: String(e.message || e).slice(0, 300) };
  }

  return res.status(200).json({ env, call });
}
