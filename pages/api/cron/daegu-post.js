// pages/api/cron/daegu-post.js — 대구 소식 자동 발행 (하루 2회, GitHub Actions에서 호출)
// 호출: POST /api/cron/daegu-post
//       Authorization: Bearer {CRON_SECRET}
// 흐름: 네이버 뉴스/블로그 수집 → 미사용 링크 필터 → AI가 주제 선택+정보글 작성 → 저장

import crypto from "crypto";
import { collectAllCandidates } from "../../../lib/collect";
import { aiWriteDaeguPost } from "../../../lib/ai";
import { saveDaeguPost, filterUnseenLinks, markDaeguSeen } from "../../../lib/redis";

const MAX_CANDIDATES_TO_AI = 25;

function todayKst() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  const auth = req.headers.authorization || "";
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // 수집은 Google 뉴스 RSS가 기본(키 불필요), 네이버 API는 env 있으면 자동 추가
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ ok: false, error: "env 누락: OPENAI_API_KEY" });
  }

  try {
    // 1) 수집
    const all = await collectAllCandidates({ days: 3 });
    if (!all.length) {
      return res.status(200).json({ ok: true, skipped: "후보 없음(수집 0건)" });
    }

    // 2) 이미 소재로 쓴 링크 제외
    const unseenLinks = new Set(await filterUnseenLinks(all.map((c) => c.link)));
    const fresh = all.filter((c) => unseenLinks.has(c.link)).slice(0, MAX_CANDIDATES_TO_AI);
    if (!fresh.length) {
      return res.status(200).json({ ok: true, skipped: "새 소재 없음(전부 사용됨)" });
    }

    // 3) AI 작성
    const today = todayKst();
    const post = await aiWriteDaeguPost({ candidates: fresh, today });
    if (!post) {
      return res.status(500).json({ ok: false, error: "AI 작성 실패" });
    }

    // 4) 저장 (id는 사용 소재 첫 링크 기준 — 같은 소재 재발행 방지)
    const idSeed = post.used_links[0] || `${today}:${post.title}`;
    const id = crypto.createHash("sha1").update(`daegu:${idSeed}`).digest("hex");

    const usedSet = new Set(post.used_links);
    const sources = fresh
      .filter((c) => usedSet.has(c.link))
      .map((c) => ({ title: c.title, link: c.link, type: c.type }));

    const isNew = await saveDaeguPost({
      id,
      source: "daegu",
      title: post.title,
      hook: post.hook,
      sections: post.sections,
      tags: post.tags,
      sources,
      date: today,
      created_at: new Date().toISOString(),
      ai_model: "gpt-4o-mini",
    });

    // 5) 사용 링크 기록 (같은 소재 재사용 방지)
    await markDaeguSeen(post.used_links);

    return res.status(200).json({
      ok: true,
      id,
      isNew,
      title: post.title,
      candidates: all.length,
      fresh: fresh.length,
      used: post.used_links.length,
    });
  } catch (e) {
    console.error("daegu-post cron error:", e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
