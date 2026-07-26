// pages/api/cron/daegu-set-image.js — 기존 글에 이미지 첨부/제거 (운영 도구)
// 호출: POST /api/cron/daegu-set-image  Authorization: Bearer {CRON_SECRET}
//       body {id, urls: ["https://...", ...]}  — 빈 배열이면 이미지 제거
// 허용 호스트는 image-proxy 화이트리스트와 동일(저작권 안전 출처만)
import { getDaeguPost, saveDaeguPost } from "../../../lib/redis";

const ALLOWED_HOSTS = [
  /(^|\.)pstatic\.net$/i,
  /(^|\.)ytimg\.com$/i,
  /(^|\.)daegu\.go\.kr$/i,
  /(^|\.)visitkorea\.or\.kr$/i,
];

export default async function handler(req, res) {
  const auth = req.headers.authorization || "";
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ ok: false });
  }
  if (req.method !== "POST") return res.status(405).json({ ok: false });

  const { id, urls } = req.body || {};
  if (!id || !/^[a-f0-9]{40}$/.test(id) || !Array.isArray(urls)) {
    return res.status(400).json({ ok: false, error: "id + urls 배열 필요" });
  }

  for (const u of urls) {
    try {
      const host = new URL(u).hostname;
      if (!ALLOWED_HOSTS.some((re) => re.test(host))) {
        return res.status(400).json({ ok: false, error: `허용되지 않은 호스트: ${host}` });
      }
    } catch {
      return res.status(400).json({ ok: false, error: `잘못된 URL: ${u}` });
    }
  }

  const post = await getDaeguPost(id);
  if (!post || !post.title) return res.status(404).json({ ok: false, error: "글 없음" });

  const images = urls.slice(0, 3).map((u) => `/api/image-proxy?url=${encodeURIComponent(u)}`);
  await saveDaeguPost({ id, images, thumbnail: images[0] || "" });

  // 페이지 캐시 즉시 갱신 (실패해도 치명적이지 않음 — ISR 주기로 곧 반영됨)
  try {
    await res.revalidate(`/daegu/${id}`);
    await res.revalidate("/daegu");
  } catch (e) {
    console.error("revalidate error:", e);
  }

  return res.status(200).json({ ok: true, id, title: post.title, images: images.length });
}
