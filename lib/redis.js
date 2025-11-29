// lib/redis.js
import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// 모든 대화는 이 키 패턴으로 저장
const convoKey = (conversationId) => `chat:conv:${conversationId}`;

// ✅ 그냥 객체 그대로 넣기 (Upstash가 알아서 JSON으로 저장/복원해 줌)
export async function appendMessage(conversationId, message) {
  const key = convoKey(conversationId);
  await redis.rpush(key, message);
}

// ✅ lrange 결과도 이미 JS 객체이므로 그대로 반환
export async function getMessages(conversationId, limit = 100) {
  const key = convoKey(conversationId);

  // 최근 limit개만 가져오고 싶으면 이렇게
  const list = await redis.lrange(key, -limit, -1);

  console.log("MESSAGES FROM REDIS:", key, list);
  return list; // 👈 여기서 절대 JSON.parse 하지 않기
}
