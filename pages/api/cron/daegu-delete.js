// pages/api/cron/daegu-delete.js — 대구 소식 글 삭제 (운영 도구)
// 호출: POST /api/cron/daegu-delete?id={postId}
//       Authorization: Bearer {CRON_SECRET}
import { deleteDaeguPost, getDaeguPost } from "../../../lib/redis";

export default async function handler(req, res) {
  const auth = req.headers.authorization || "";
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.query;
  if (!id) return res.status(400).json({ ok: false, error: "id 필요" });

  const existing = await getDaeguPost(id);
  if (!existing || !existing.title) {
    return res.status(404).json({ ok: false, error: "해당 글 없음" });
  }

  await deleteDaeguPost(id);

  try {
    await res.revalidate("/daegu");
  } catch (e) {
    console.error("revalidate error:", e);
  }

  return res.status(200).json({ ok: true, deleted: id, title: existing.title });
}
