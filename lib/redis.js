// lib/redis.js
import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export async function deleteSummary(id) {
  if (!id) return false;

  // 1) 상세 해시 삭제
  await redis.del(summaryKey(id)); // == smilekey:summary:${id}

  // 2) 중복방지 set에서 제거
  await redis.srem(SUMMARY_IDS_SET_KEY, id);

  // 3) 목록 list에서 제거 (리스트에 있던 id 모두 제거)
  // Upstash Redis는 LREM 지원함
  await redis.lrem(SUMMARY_LIST_KEY, 0, id);

  return true;
}

// ====== (추가) 요약 아카이브 ======
const SUMMARY_LIST_KEY = "smilekey:summaries:v1";       // 최신 목록(id들)
const SUMMARY_IDS_SET_KEY = "smilekey:summary_ids:v1";  // 중복 방지
const summaryKey = (id) => `smilekey:summary:${id}`;    // 상세

export async function saveSummary(item) {
  const exists = await redis.sismember(SUMMARY_IDS_SET_KEY, item.id);

  const toSave = { ...item };

  if (Array.isArray(toSave.images)) {
    toSave.images = JSON.stringify(toSave.images);
  }

  await redis.hset(summaryKey(item.id), toSave);

  if (exists) return false;

  await redis.sadd(SUMMARY_IDS_SET_KEY, item.id);
  await redis.lpush(SUMMARY_LIST_KEY, item.id);
  await redis.ltrim(SUMMARY_LIST_KEY, 0, 199);
  return true;
}




export async function listSummaryIds(limit = 50) {
  return (await redis.lrange("smilekey:summaries:v1", 0, limit - 1)) || [];
}

// ====== (추가) 대구 소식 ======
// 작업 아카이브(smilekey:summaries:v1)와 별도 리스트 — 서로 트림에 밀리지 않도록 분리
const DAEGU_LIST_KEY = "smilekey:daegu:list:v1";
const DAEGU_IDS_SET_KEY = "smilekey:daegu:ids:v1";
const DAEGU_SEEN_KEY = "smilekey:daegu:seen:v1"; // 소재로 이미 사용한 원문 링크
const daeguKey = (id) => `smilekey:daegu:${id}`;

export async function saveDaeguPost(post) {
  const exists = await redis.sismember(DAEGU_IDS_SET_KEY, post.id);

  const toSave = { ...post };
  for (const k of ["sections", "tags", "sources"]) {
    if (Array.isArray(toSave[k])) toSave[k] = JSON.stringify(toSave[k]);
  }

  await redis.hset(daeguKey(post.id), toSave);

  if (exists) return false;

  await redis.sadd(DAEGU_IDS_SET_KEY, post.id);
  await redis.lpush(DAEGU_LIST_KEY, post.id);
  await redis.ltrim(DAEGU_LIST_KEY, 0, 499);
  return true;
}

export async function listDaeguIds(limit = 50) {
  return (await redis.lrange(DAEGU_LIST_KEY, 0, limit - 1)) || [];
}

export async function getDaeguPost(id) {
  const data = await redis.hgetall(daeguKey(id));
  if (!data) return null;

  for (const k of ["sections", "tags", "sources"]) {
    if (data[k] && typeof data[k] === "string") {
      try {
        const arr = JSON.parse(data[k]);
        if (Array.isArray(arr)) data[k] = arr;
      } catch {}
    }
  }
  return data;
}

export async function deleteDaeguPost(id) {
  if (!id) return false;
  await redis.del(daeguKey(id));
  await redis.srem(DAEGU_IDS_SET_KEY, id);
  await redis.lrem(DAEGU_LIST_KEY, 0, id);
  await redis.zrem(DAEGU_VIEWS_KEY, id);
  await redis.zrem(DAEGU_LIKES_KEY, id);
  await redis.zrem(DAEGU_SHARES_KEY, id);
  await redis.del(daeguCommentsKey(id));
  return true;
}

// ====== 대구 소식 조회수 (ZSET 랭킹) ======
const DAEGU_VIEWS_KEY = "smilekey:daegu:views:v1";

export async function incrDaeguView(id) {
  const score = await redis.zincrby(DAEGU_VIEWS_KEY, 1, id);
  return Number(score) || 0;
}

export async function getDaeguView(id) {
  const score = await redis.zscore(DAEGU_VIEWS_KEY, id);
  return Number(score) || 0;
}

export async function getDaeguViewMap(ids = []) {
  const scores = await Promise.all(ids.map((id) => redis.zscore(DAEGU_VIEWS_KEY, id)));
  const map = {};
  ids.forEach((id, i) => {
    map[id] = Number(scores[i]) || 0;
  });
  return map;
}

// 조회수 상위 n개 id (조회 0은 제외)
export async function topDaeguViewIds(n = 3) {
  const flat = await redis.zrange(DAEGU_VIEWS_KEY, 0, n - 1, { rev: true, withScores: true });
  const out = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const views = Number(flat[i + 1]) || 0;
    if (views > 0) out.push({ id: String(flat[i]), views });
  }
  return out;
}

// ====== 대구 소식 좋아요/공유 ======
const DAEGU_LIKES_KEY = "smilekey:daegu:likes:v1";
const DAEGU_SHARES_KEY = "smilekey:daegu:shares:v1";

export async function incrDaeguLike(id, delta = 1) {
  const score = await redis.zincrby(DAEGU_LIKES_KEY, delta, id);
  const n = Number(score) || 0;
  if (n < 0) {
    await redis.zadd(DAEGU_LIKES_KEY, { score: 0, member: id });
    return 0;
  }
  return n;
}

export async function getDaeguLike(id) {
  return Number(await redis.zscore(DAEGU_LIKES_KEY, id)) || 0;
}

export async function getDaeguLikeMap(ids = []) {
  const scores = await Promise.all(ids.map((id) => redis.zscore(DAEGU_LIKES_KEY, id)));
  const map = {};
  ids.forEach((id, i) => {
    map[id] = Number(scores[i]) || 0;
  });
  return map;
}

export async function incrDaeguShare(id) {
  return Number(await redis.zincrby(DAEGU_SHARES_KEY, 1, id)) || 0;
}

// ====== 대구 소식 댓글 ======
const daeguCommentsKey = (id) => `smilekey:daegu:comments:${id}`;

export async function addDaeguComment(id, { name, text }) {
  const comment = {
    cid: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    name: String(name || "익명").slice(0, 20),
    text: String(text || "").slice(0, 500),
    ts: new Date().toISOString(),
  };
  await redis.lpush(daeguCommentsKey(id), comment);
  await redis.ltrim(daeguCommentsKey(id), 0, 499);
  return comment;
}

export async function listDaeguComments(id, limit = 50) {
  const [items, total] = await Promise.all([
    redis.lrange(daeguCommentsKey(id), 0, limit - 1),
    redis.llen(daeguCommentsKey(id)),
  ]);
  return { items: items || [], total: Number(total) || 0 };
}

export async function deleteDaeguComment(id, cid) {
  const items = (await redis.lrange(daeguCommentsKey(id), 0, -1)) || [];
  const target = items.find((c) => c && c.cid === cid);
  if (!target) return false;
  await redis.lrem(daeguCommentsKey(id), 1, target);
  return true;
}

// 단순 IP 레이트리밋: windowSec 내 limit회 초과 시 false
export async function rateLimitOk(bucket, ip, { limit = 5, windowSec = 600 } = {}) {
  const key = `smilekey:rl:${bucket}:${ip}`;
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, windowSec);
  return n <= limit;
}

export async function filterUnseenLinks(links = []) {
  const out = [];
  for (const link of links) {
    const seen = await redis.sismember(DAEGU_SEEN_KEY, link);
    if (!seen) out.push(link);
  }
  return out;
}

export async function markDaeguSeen(links = []) {
  if (!links.length) return;
  await redis.sadd(DAEGU_SEEN_KEY, ...links);
}

export async function getSummary(id) {
  const data = await redis.hgetall(`smilekey:summary:${id}`);

  if (data?.images && typeof data.images === "string") {
    try {
      const arr = JSON.parse(data.images);
      if (Array.isArray(arr)) data.images = arr;
    } catch {}
  }

  return data;
}