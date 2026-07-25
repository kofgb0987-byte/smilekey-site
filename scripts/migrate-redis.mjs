// scripts/migrate-redis.mjs — Upstash → 로컬 SRH(smilekey redis) 데이터 이사
// 사용:
//   node scripts/migrate-redis.mjs \
//     (env) SRC_URL=https://xxx.upstash.io SRC_TOKEN=... \
//           DST_URL=https://skdb.hyeongeonnoil.com DST_TOKEN=...
// 복사 대상: smilekey:* (아카이브/대구소식), chat:conv:* (채팅, TTL 유지)
// 멱등: 다시 실행해도 덮어쓸 뿐 중복 안 생김.

import { Redis } from "@upstash/redis";

const { SRC_URL, SRC_TOKEN, DST_URL, DST_TOKEN } = process.env;
if (!SRC_URL || !SRC_TOKEN || !DST_URL || !DST_TOKEN) {
  console.error("env 필요: SRC_URL, SRC_TOKEN, DST_URL, DST_TOKEN");
  process.exit(1);
}

const src = new Redis({ url: SRC_URL, token: SRC_TOKEN });
const dst = new Redis({ url: DST_URL, token: DST_TOKEN });

async function scanAll(pattern) {
  const keys = [];
  let cursor = 0;
  do {
    const [next, batch] = await src.scan(cursor, { match: pattern, count: 100 });
    cursor = Number(next);
    keys.push(...batch);
  } while (cursor !== 0);
  return keys;
}

async function copyKey(key) {
  const type = await src.type(key);

  switch (type) {
    case "hash": {
      const data = await src.hgetall(key);
      if (data && Object.keys(data).length) {
        await dst.del(key);
        await dst.hset(key, data);
      }
      break;
    }
    case "list": {
      const items = await src.lrange(key, 0, -1);
      if (items.length) {
        await dst.del(key);
        await dst.rpush(key, ...items);
      }
      break;
    }
    case "set": {
      const members = await src.smembers(key);
      if (members.length) {
        await dst.del(key);
        await dst.sadd(key, ...members);
      }
      break;
    }
    case "string": {
      const val = await src.get(key);
      if (val !== null) await dst.set(key, val);
      break;
    }
    case "zset": {
      const entries = await src.zrange(key, 0, -1, { withScores: true });
      if (entries.length) {
        await dst.del(key);
        const args = [];
        for (let i = 0; i < entries.length; i += 2) {
          args.push({ score: Number(entries[i + 1]), member: entries[i] });
        }
        await dst.zadd(key, ...args);
      }
      break;
    }
    default:
      console.warn(`  스킵(미지원 타입 ${type}): ${key}`);
      return false;
  }

  // TTL 유지 (chat:conv:* 7일 TTL)
  const ttl = await src.ttl(key);
  if (ttl > 0) await dst.expire(key, ttl);

  return true;
}

const patterns = ["smilekey:*", "chat:conv:*"];
let total = 0;

for (const pattern of patterns) {
  const keys = await scanAll(pattern);
  console.log(`\n${pattern}: ${keys.length}개 키`);
  for (const key of keys) {
    const ok = await copyKey(key);
    if (ok) total++;
  }
}

// 검증: 핵심 리스트 길이 비교
for (const listKey of ["smilekey:summaries:v1"]) {
  const [srcLen, dstLen] = [await src.llen(listKey), await dst.llen(listKey)];
  console.log(`검증 ${listKey}: src=${srcLen} dst=${dstLen} ${srcLen === dstLen ? "✅" : "❌"}`);
}

console.log(`\n완료: ${total}개 키 복사됨`);
