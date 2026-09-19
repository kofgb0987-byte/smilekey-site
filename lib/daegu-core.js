// lib/daegu-core.js — 대구 소식 공통 로직 (주제 중복 판정·근거 검증·저장)
//
// 작성 백엔드가 무엇이든(서버 OpenAI 폴백 / 로컬 claude -p 구독) 검증·저장은 전부 여기를 지난다.
// 08-24 중복발행 사고 이후 다듬은 판정 규칙이 두 경로에 갈라지지 않게 하기 위한 단일 지점.

import crypto from "crypto";
import { fetchOgImage } from "./og";
import { searchNaver } from "./naver";
import { pingIndexNow } from "./indexnow";
import { redis, saveDaeguPost, markDaeguSeen } from "./redis";

// 모델에게 넘기는 후보 수 — 선발은 lib/candidates.js pickBalancedCandidates(소스·쿼리 라운드로빈)
export const MAX_CANDIDATES_TO_AI = 40;
// 주제 중복 비교 대상 최근 발행글 수 — 2주+ 이어지는 행사(마스터즈육상 등)가 창 밖에서
// 재등장하지 않게 넉넉히 (08-24 중복발행 사고)
export const RECENT_TITLES_FOR_DEDUP = 20;
export const MAX_ATTEMPTS = 3;

export function todayKst() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// 제목 유사도 백스톱 — 프롬프트 배제를 뚫고 같은 행사가 언론사만 바꿔 다시 뽑히는 경우 차단.
// 띄어쓰기가 달라도("봉화 은어축제" vs "봉화은어축제") 잡히도록 공백 제거 문자열에 대한
// 부분문자열 매칭을 쓰고, 변별 토큰이 2개 이상 겹치면 같은 주제로 본다.
const COMMON_WORDS = [
  "대구", "경북", "축제", "행사", "소식", "개최", "여름", "겨울", "봄", "가을",
  "특별", "다양", "즐거움", "추억", "함께", "가득",
];

export function distinctiveTokens(title) {
  // 흔한 단어는 토큰을 통째로 버리지 말고 접두사만 벗긴다 — startsWith 필터가
  // "대구퀴어문화축제" 같은 행사명 토큰 전체를 삭제해 중복발행을 못 잡던 사고(08-24) 수정.
  const out = new Set();
  for (let t of String(title).replace(/[^0-9A-Za-z가-힣\s]/g, " ").split(/\s+/)) {
    let stripped = true;
    while (stripped) {
      stripped = false;
      for (const c of COMMON_WORDS) {
        if (t.startsWith(c) && t.length > c.length) {
          t = t.slice(c.length);
          stripped = true;
        }
      }
    }
    // 접두사를 벗기고 남은 조사류("에서" 등)가 오탐을 만들지 않게 3자 미만은 버림
    if (t.length >= 3 && !/^\d+$/.test(t) && !COMMON_WORDS.includes(t)) out.add(t);
  }
  return out;
}

function titleCompact(title) {
  return String(title).replace(/[^0-9A-Za-z가-힣]/g, "");
}

function commonPrefixLen(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

export function sameTopic(a, b) {
  const mine = distinctiveTokens(a);
  const theirs = distinctiveTokens(b);
  const aCompact = titleCompact(a);
  const bCompact = titleCompact(b);
  let shared = 0;
  for (const t of mine) if (bCompact.includes(t)) shared++;
  for (const t of theirs) if (!mine.has(t) && aCompact.includes(t)) shared++;
  if (shared >= 2) return true;
  // 행사명 표기 변형("육상대회"/"육상경기대회") 대응 — 6자+ 공통 접두 토큰쌍은 단독으로도 동일 주제
  for (const t of mine) for (const u of theirs) if (commonPrefixLen(t, u) >= 6) return true;
  return false;
}

export function findDupTitle(title, recentTitles) {
  for (const prev of recentTitles) {
    if (sameTopic(title, prev)) return prev;
  }
  return null;
}

// 차단된 주제(중복·종료 행사)의 남은 후보 링크 전부 — 통째로 seen 처리해서
// 같은 주제가 링크만 바꿔 다음 회차(특히 하루 1회뿐인 크론)를 잡아먹는 것을 막는다.
function topicLinks(refTitles, cands) {
  return cands
    .filter((c) => refTitles.some((t) => sameTopic(t, c.title)))
    .map((c) => c.link);
}

export function burnSet(post, fresh) {
  const usedTitles = fresh
    .filter((c) => post.used_links.includes(c.link))
    .map((c) => c.title);
  return [...new Set([...post.used_links, ...topicLinks([post.title, ...usedTitles], fresh)])];
}

// ---------- 후보 배치 스냅샷 ----------
// 후보 공급 시점에 "모델이 실제로 본 후보(fresh)"와 최근 제목을 짧게 보관해, 저장 단계가
// 그 스냅샷으로 검증하게 한다. 전체 수집분(all)은 넣지 않는다 — 430건 본문까지 담으면
// 터널 너머 Redis 왕복이 비대해지고, 재시도 때 재수집(4초)이 더 싸다.

const BATCH_TTL_SEC = 3600;

export async function saveBatch(payload) {
  const token = crypto.randomBytes(12).toString("hex");
  await redis.set(`daegu:batch:${token}`, JSON.stringify(payload), { ex: BATCH_TTL_SEC });
  return token;
}

export async function loadBatch(token) {
  if (!token) return null;
  const raw = await redis.get(`daegu:batch:${token}`);
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

// ---------- 검증 ----------
// 초안이 발행 가능한지 판정하고, 막히면 그 주제를 소진(seen)시킨다.
// 반환: {ok:true} | {ok:false, reason}
export async function validateDraft({ draft, fresh, recentTitles, review, today }) {
  // 주제 중복 백스톱 — 최근 글과 제목 핵심 키워드가 겹치면 주제 통째 소진
  const dupOf = findDupTitle(draft.title, recentTitles);
  if (dupOf) {
    await markDaeguSeen(burnSet(draft, fresh));
    return { ok: false, reason: `동일 주제 중복: ${draft.title} (기존: ${dupOf})` };
  }

  // 다중 근거 강제 — 실제 후보에 존재하는 링크만 인정(AI가 링크를 지어내는 것 방지)
  // 예외: 공공기관 공식 소스(official)는 단독 근거 허용
  const freshLinks = new Set(fresh.map((c) => c.link));
  draft.used_links = draft.used_links.filter((l) => freshLinks.has(l));
  const officialLinks = new Set(fresh.filter((c) => c.type === "official").map((c) => c.link));
  const hasOfficial = draft.used_links.some((l) => officialLinks.has(l));
  if (draft.used_links.length < 2 && !hasOfficial) {
    // 링크가 전부 날조라 소진할 게 없으면 제목 매칭으로 주제째 소진 — 무한 재선택 방지
    await markDaeguSeen(draft.used_links.length ? draft.used_links : burnSet(draft, fresh));
    return { ok: false, reason: `근거 부족(기사 2개 미만): ${draft.title}` };
  }

  // 발행 전 팩트체크 결과 반영 — 종료 행사로 판정되면 주제 자체가 죽은 것이므로 통째로 소진
  if (review && !review.approved) {
    await markDaeguSeen(review.ended ? burnSet(draft, fresh) : draft.used_links);
    return { ok: false, reason: `검수 거부: ${draft.title} — ${(review.issues || []).join(" / ")}` };
  }

  return { ok: true };
}

// ---------- 저장 ----------
// 이미지 확보 → Redis 저장 → 소재 소진 기록 → 목록 재검증 → IndexNow 통지
export async function finalizePost({ post, fresh, all, today, aiModel, res }) {
  // id는 사용 소재 첫 링크 기준 — 같은 소재 재발행 방지
  const idSeed = post.used_links[0] || `${today}:${post.title}`;
  const id = crypto.createHash("sha1").update(`daegu:${idSeed}`).digest("hex");

  const usedSet = new Set(post.used_links);
  const usedCands = fresh.filter((c) => usedSet.has(c.link));
  const sources = usedCands.map((c) => ({ title: c.title, link: c.link, type: c.type }));

  // 근거 후보의 공식 이미지(시청 보도사진·TourAPI 포스터) — 프록시 경유, 최대 3장
  let images = [...new Set(usedCands.map((c) => c.image).filter(Boolean))]
    .slice(0, 3)
    .map((u) => `/api/image-proxy?url=${encodeURIComponent(u)}`);

  // 공식 이미지가 없으면 기사 원문의 og:image를 시도. Google뉴스 링크는 서버 리졸브 불가라
  // 근거가 구글 링크뿐이면 후보군에서 같은 주제의 직접 링크(네이버 originallink 등)를 찾아 시도.
  // 언론사 도메인은 화이트리스트 밖이므로 HMAC 서명으로 중계 허용.
  if (!images.length) {
    const pool = Array.isArray(all) && all.length ? all : fresh;
    const usedTitles = usedCands.map((c) => c.title);
    const directCands = [
      ...usedCands,
      ...pool.filter(
        (c) =>
          !usedSet.has(c.link) &&
          [post.title, ...usedTitles].some((t) => sameTopic(t, c.title))
      ),
    ].filter((c) => c.link && !c.link.includes("news.google.com"));

    // 3차 폴백: 후보 풀에 직접 링크가 없으면 글 제목 핵심 키워드로 네이버 뉴스를
    // 즉석 검색해 원문(originallink)을 확보 (네이버 env 없으면 조용히 스킵)
    if (!directCands.length) {
      try {
        const q = [...distinctiveTokens(post.title)].slice(0, 3).join(" ");
        if (q) {
          const found = await searchNaver("news", q, { display: 5, sort: "sim" });
          for (const it of found) {
            const l = (it.originallink || it.link || "").trim();
            if (l && !l.includes("news.google.com")) directCands.push({ link: l });
          }
        }
      } catch (e) {
        console.error("image fallback naver search error:", e.message);
      }
    }

    for (const c of directCands.slice(0, 3)) {
      const og = await fetchOgImage(c.link, { timeoutMs: 5000 });
      if (og) {
        const sig = crypto
          .createHmac("sha256", process.env.CRON_SECRET)
          .update(og)
          .digest("hex")
          .slice(0, 32);
        images = [`/api/image-proxy?url=${encodeURIComponent(og)}&sig=${sig}`];
        break;
      }
    }
  }

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
    ai_model: aiModel,
  });

  // 사용 링크 기록 (같은 소재 재사용 방지)
  await markDaeguSeen(post.used_links);

  // 목록 페이지 캐시 즉시 갱신 — 새 글이 발행 직후 보이도록
  if (res && typeof res.revalidate === "function") {
    try {
      await res.revalidate("/daegu");
    } catch (e) {
      console.error("revalidate error:", e);
    }
  }

  // 검색엔진(네이버 등)에 새 글 즉시 통지 — 수동 수집요청 대체
  const indexnow = await pingIndexNow([
    `https://smilekey.me/daegu/${id}`,
    "https://smilekey.me/daegu",
  ]);

  return { id, isNew, indexnow };
}
