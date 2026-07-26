// pages/api/cron/daegu-post.js — 대구 소식 자동 발행 (하루 2회, GitHub Actions에서 호출)
// 호출: POST /api/cron/daegu-post
//       Authorization: Bearer {CRON_SECRET}
// 흐름: 네이버 뉴스/블로그 수집 → 미사용 링크 필터 → AI가 주제 선택+정보글 작성 → 저장

import crypto from "crypto";
import { collectAllCandidates } from "../../../lib/collect";
import { aiWriteDaeguPost, aiReviewDaeguPost } from "../../../lib/ai";
import { saveDaeguPost, filterUnseenLinks, markDaeguSeen } from "../../../lib/redis";

// 예고 기사(행사 며칠 전 보도)가 최신순 정렬에서 잘리지 않도록 넉넉히
const MAX_CANDIDATES_TO_AI = 40;

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
    // 1) 수집 — 4일: 축제 예고 기사가 행사 직전에 범위 밖으로 밀리지 않게
    const all = await collectAllCandidates({ days: 4 });
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
    if (post.skip) {
      return res.status(200).json({ ok: true, skipped: `작성 스킵: ${post.reason}` });
    }

    // 3-1) 다중 근거 강제 — 실제 후보에 존재하는 링크만 인정(AI가 링크를 지어내는 것 방지)
    //      예외: 공공기관 공식 소스(official)는 단독 근거 허용
    const freshLinks = new Set(fresh.map((c) => c.link));
    post.used_links = post.used_links.filter((l) => freshLinks.has(l));
    const officialLinks = new Set(fresh.filter((c) => c.type === "official").map((c) => c.link));
    const hasOfficial = post.used_links.some((l) => officialLinks.has(l));
    if (post.used_links.length < 2 && !hasOfficial) {
      await markDaeguSeen(post.used_links); // 같은 단일근거 주제 반복 방지
      return res.status(200).json({ ok: true, skipped: "근거 부족(기사 2개 미만)", title: post.title });
    }

    // 3-2) 발행 전 팩트체크 — 거부되면 발행 안 함
    const review = await aiReviewDaeguPost({ post, candidates: fresh, today });
    if (!review.approved) {
      await markDaeguSeen(post.used_links); // 같은 문제 주제 반복 방지
      return res.status(200).json({
        ok: true,
        skipped: "검수 거부",
        title: post.title,
        issues: review.issues,
      });
    }

    // 4) 저장 (id는 사용 소재 첫 링크 기준 — 같은 소재 재발행 방지)
    const idSeed = post.used_links[0] || `${today}:${post.title}`;
    const id = crypto.createHash("sha1").update(`daegu:${idSeed}`).digest("hex");

    const usedSet = new Set(post.used_links);
    const usedCands = fresh.filter((c) => usedSet.has(c.link));
    const sources = usedCands.map((c) => ({ title: c.title, link: c.link, type: c.type }));

    // 근거 후보의 공식 이미지(시청 보도사진·TourAPI 포스터) — 프록시 경유, 최대 3장
    const images = [...new Set(usedCands.map((c) => c.image).filter(Boolean))]
      .slice(0, 3)
      .map((u) => `/api/image-proxy?url=${encodeURIComponent(u)}`);

    const isNew = await saveDaeguPost({
      id,
      source: "daegu",
      title: post.title,
      hook: post.hook,
      sections: post.sections,
      tags: post.tags,
      sources,
      images,
      thumbnail: images[0] || "",
      date: today,
      created_at: new Date().toISOString(),
      ai_model: "gpt-4o-mini",
    });

    // 5) 사용 링크 기록 (같은 소재 재사용 방지)
    await markDaeguSeen(post.used_links);

    // 목록 페이지 캐시 즉시 갱신 — 새 글이 발행 직후 보이도록
    try {
      await res.revalidate("/daegu");
    } catch (e) {
      console.error("revalidate error:", e);
    }

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
