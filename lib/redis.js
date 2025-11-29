// lib/redis.js
import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const convoKey = (conversationId) => `chat:conv:${conversationId}`;

export async function appendMessage(conversationId, message) {
  await redis.rpush(convoKey(conversationId), JSON.stringify(message));
}

export async function getMessages(conversationId, limit = 100) {
  const key = convoKey(conversationId);
  // 🔥 전체 범위로 변경 (0 ~ -1)
  const list = await redis.lrange(key, 0, -1);

  const parsed = list
    .map((str) => {
      try {
        return JSON.parse(str);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  console.log("MESSAGES API DATA:", conversationId, "len=", parsed.length);

  return parsed;
}
