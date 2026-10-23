// pages/api/cron/daegu-delete.js — 대구 소식 글 삭제 (운영 도구)
// 호출: POST /api/cron/daegu-delete?id={postId}
//       Authorization: Bearer {CRON_SECRET}
import { deleteDaeguPost, getDaeguPost } from "../../../lib/redis";
import { rebuildSitemapSafe } from "../../../lib/sitemap";

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

  // 목록과 함께 상세 페이지도 즉시 재검증 — 상세 ISR 이 24h 라 지우지 않으면 하루 동안 남는다(2026-10-23)
  for (const path of ["/daegu", `/daegu/${id}`]) {
    try {
      await res.revalidate(path);
    } catch (e) {
      console.error("revalidate error:", path, e);
    }
  }
  const sitemap = await rebuildSitemapSafe("daegu delete"); // 삭제된 URL이 사이트맵에서 바로 빠지게

  return res.status(200).json({ ok: true, deleted: id, title: existing.title, sitemap });
}
