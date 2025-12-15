// lib/redis.js
import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// ====== (기존) 채팅 대화 ======
const convoKey = (conversationId) => `chat:conv:${conversationId}`;

export async function appendMessage(conversationId, message) {
  const key = convoKey(conversationId);
  await redis.rpush(key, message);
}

export async function getMessages(conversationId, limit = 100) {
  const key = convoKey(conversationId);
  const list = await redis.lrange(key, -limit, -1);
  return list;
}

// ====== (추가) 요약 아카이브 ======
const SUMMARY_LIST_KEY = "smilekey:summaries:v1";       // 최신 목록(id들)
const SUMMARY_IDS_SET_KEY = "smilekey:summary_ids:v1";  // 중복 방지
const summaryKey = (id) => `smilekey:summary:${id}`;    // 상세

export async function saveSummary(item) {
  const exists = await redis.sismember(SUMMARY_IDS_SET_KEY, item.id);

  await redis.hset(summaryKey(item.id), item);

  if (exists) return false;

  await redis.sadd(SUMMARY_IDS_SET_KEY, item.id);
  await redis.lpush(SUMMARY_LIST_KEY, item.id);
  await redis.ltrim(SUMMARY_LIST_KEY, 0, 199);
  return true;
}




export async function listSummaryIds(limit = 50) {
  return (await redis.lrange("smilekey:summaries:v1", 0, limit - 1)) || [];
}

export async function getSummary(id) {
  return await redis.hgetall(`smilekey:summary:${id}`);
}
