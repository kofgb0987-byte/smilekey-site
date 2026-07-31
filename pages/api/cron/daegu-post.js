// pages/api/cron/daegu-post.js — 대구 소식 자동 발행 (하루 2회, GitHub Actions에서 호출)
// 호출: POST /api/cron/daegu-post
//       Authorization: Bearer {CRON_SECRET}
// 흐름: 네이버 뉴스/블로그 수집 → 미사용 링크 필터 → AI가 주제 선택+정보글 작성 → 저장

import crypto from "crypto";
import { collectAllCandidates } from "../../../lib/collect";
import { aiWriteDaeguPost, aiReviewDaeguPost } from "../../../lib/ai";
import {
  saveDaeguPost,
  filterUnseenLinks,
  markDaeguSeen,
  listDaeguIds,
  getDaeguPost,
} from "../../../lib/redis";

// 재시도 포함 최대 6회 AI 호출 — 기본 한도(수십 초)로는 부족할 수 있음
export const config = { maxDuration: 300 };

// 예고 기사(행사 며칠 전 보도)가 최신순 정렬에서 잘리지 않도록 넉넉히
const MAX_CANDIDATES_TO_AI = 40;
// 주제 중복 비교 대상 최근 발행글 수
const RECENT_TITLES_FOR_DEDUP = 10;

function todayKst() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// 제목 유사도 백스톱 — 프롬프트 배제를 뚫고 같은 행사가 언론사만 바꿔 다시 뽑히는 경우 차단.
// 띄어쓰기가 달라도("봉화 은어축제" vs "봉화은어축제") 잡히도록 공백 제거 문자열에 대한
// 부분문자열 매칭을 쓰고, 변별 토큰이 2개 이상 겹치면 같은 주제로 본다.
const COMMON_WORDS = [
  "대구", "경북", "축제", "행사", "소식", "개최", "여름", "겨울", "봄", "가을",
  "특별", "다양", "즐거움", "추억", "함께", "가득",
];

function distinctiveTokens(title) {
  return new Set(
    String(title)
      .replace(/[^0-9A-Za-z가-힣\s]/g, " ")
      .split(/\s+/)
      .filter(
        (t) =>
          t.length >= 2 && !/^\d+$/.test(t) && !COMMON_WORDS.some((c) => t.startsWith(c))
      )
  );
}

function titleCompact(title) {
  return String(title).replace(/[^0-9A-Za-z가-힣]/g, "");
}

function sameTopic(a, b) {
  const mine = distinctiveTokens(a);
  const theirs = distinctiveTokens(b);
  const aCompact = titleCompact(a);
  const bCompact = titleCompact(b);
  let shared = 0;
  for (const t of mine) if (bCompact.includes(t)) shared++;
  for (const t of theirs) if (!mine.has(t) && aCompact.includes(t)) shared++;
  return shared >= 2;
}

function findDupTitle(title, recentTitles) {
  for (const prev of recentTitles) {
    if (sameTopic(title, prev)) return prev;
  }
  return null;
}

// 차단된 주제(중복·종료 행사)의 남은 후보 링크 전부 — 통째로 seen 처리해서
// 같은 주제가 링크만 바꿔 다음 회차(특히 하루 1회뿐인 크론)를 잡아먹는 것을 막는다.
// 기준 제목은 AI 글제목+실제 근거 기사제목 — 기사끼리가 토큰이 더 많이 겹쳐 매칭이 잘 된다.
function topicLinks(refTitles, cands) {
  return cands
    .filter((c) => refTitles.some((t) => sameTopic(t, c.title)))
    .map((c) => c.link);
}

function burnSet(post, fresh) {
  const usedTitles = fresh
    .filter((c) => post.used_links.includes(c.link))
    .map((c) => c.title);
  return [...new Set([...post.used_links, ...topicLinks([post.title, ...usedTitles], fresh)])];
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

    // 2~3) 소재 선정→작성→검수. 선택된 주제가 차단(중복·근거부족·검수거부)되면
    //      해당 소재를 소진(seen)하고 남은 후보로 재시도 — 첫 선택이 막혔다고
    //      회차를 빈손으로 끝내지 않는다(7/30 하루 2회 모두 스킵된 실사고 대응).
    const recentIds = await listDaeguIds(RECENT_TITLES_FOR_DEDUP);
    const recentTitles = (await Promise.all(recentIds.map((rid) => getDaeguPost(rid))))
      .map((p) => p && p.title)
      .filter(Boolean);

    const today = todayKst();
    const MAX_ATTEMPTS = 3;
    let post = null;
    let fresh = null;
    const skips = [];

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      // 매 시도마다 재계산 — 직전 시도에서 소진된 링크를 반영
      const unseenLinks = new Set(await filterUnseenLinks(all.map((c) => c.link)));
      fresh = all.filter((c) => unseenLinks.has(c.link)).slice(0, MAX_CANDIDATES_TO_AI);
      if (!fresh.length) {
        return res.status(200).json({ ok: true, skipped: "새 소재 없음(전부 사용됨)", attempts: skips });
      }

      const draft = await aiWriteDaeguPost({ candidates: fresh, today, recentTitles });
      if (!draft) {
        return res.status(500).json({ ok: false, error: "AI 작성 실패", attempts: skips });
      }
      if (draft.skip) {
        return res.status(200).json({ ok: true, skipped: `작성 스킵: ${draft.reason}`, attempts: skips });
      }

      // 주제 중복 백스톱 — 최근 글과 제목 핵심 키워드가 겹치면 주제 통째 소진 후 재시도
      const dupOf = findDupTitle(draft.title, recentTitles);
      if (dupOf) {
        await markDaeguSeen(burnSet(draft, fresh));
        skips.push(`동일 주제 중복: ${draft.title} (기존: ${dupOf})`);
        continue;
      }

      // 다중 근거 강제 — 실제 후보에 존재하는 링크만 인정(AI가 링크를 지어내는 것 방지)
      // 예외: 공공기관 공식 소스(official)는 단독 근거 허용
      const freshLinks = new Set(fresh.map((c) => c.link));
      draft.used_links = draft.used_links.filter((l) => freshLinks.has(l));
      const officialLinks = new Set(fresh.filter((c) => c.type === "official").map((c) => c.link));
      const hasOfficial = draft.used_links.some((l) => officialLinks.has(l));
      if (draft.used_links.length < 2 && !hasOfficial) {
        await markDaeguSeen(draft.used_links); // 같은 단일근거 주제 반복 방지
        skips.push(`근거 부족(기사 2개 미만): ${draft.title}`);
        continue;
      }

      // 발행 전 팩트체크 — 종료 행사로 판정되면 주제 자체가 죽은 것이므로 통째로 소진
      const review = await aiReviewDaeguPost({ post: draft, candidates: fresh, today });
      if (!review.approved) {
        await markDaeguSeen(review.ended ? burnSet(draft, fresh) : draft.used_links);
        skips.push(`검수 거부: ${draft.title} — ${(review.issues || []).join(" / ")}`);
        continue;
      }

      post = draft;
      break;
    }

    if (!post) {
      return res.status(200).json({ ok: true, skipped: `${MAX_ATTEMPTS}회 시도 모두 차단`, attempts: skips });
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
      ...(skips.length ? { retried: skips } : {}),
    });
  } catch (e) {
    console.error("daegu-post cron error:", e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
