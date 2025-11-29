// lib/redis.js
import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const convoKey = (conversationId) => `chat:conv:${conversationId}`;

// 메시지 저장
export async function appendMessage(conversationId, message) {
  await redis.rpush(convoKey(conversationId), JSON.stringify(message));
}

// 최근 메시지 가져오기
export async function getMessages(conversationId, limit = 50) {
  const key = convoKey(conversationId);
  const list = await redis.lrange(key, -limit, -1);
  return list
    .map((str) => {
      try {
        return JSON.parse(str);
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean);
}
