// pages/api/daegu/view.js — 대구 소식 조회수
//   POST ?id=... : +1 후 현재 조회수 반환 (상세 페이지 최초 진입)
//   GET  ?id=... : 조회수만 반환 (같은 세션 재방문)
import { incrDaeguView, getDaeguView, getDaeguPost } from "../../../lib/redis";

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id || !/^[a-f0-9]{40}$/.test(id)) {
    return res.status(400).json({ ok: false, error: "invalid id" });
  }

  try {
    if (req.method === "POST") {
      // 존재하는 글만 카운트 (임의 id로 zset 오염 방지)
      const post = await getDaeguPost(id);
      if (!post || !post.title) return res.status(404).json({ ok: false });
      const views = await incrDaeguView(id);
      return res.status(200).json({ ok: true, views });
    }
    const views = await getDaeguView(id);
    return res.status(200).json({ ok: true, views });
  } catch (e) {
    console.error("daegu view error:", e);
    return res.status(500).json({ ok: false });
  }
}
