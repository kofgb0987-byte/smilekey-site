// middleware.js — 봇(AI·검색·미리보기) 방문을 Redis에 집계한다. (2026-09-24)
// 목적: AI 크롤러(GPTBot·ClaudeBot·PerplexityBot…)가 실제로 어떤 페이지를 읽어 가는지 보기 위한 측정.
// 사람 요청은 UA 정규식 한 번으로 통과하고 아무것도 하지 않는다. 봇이면 응답을 기다리지 않고(waitUntil)
// Redis에 HINCRBY 한 번. Redis가 죽어 있어도 응답에는 영향 없음(2.5초 타임아웃, 실패 무시).
// 키: smilekey:bots:<YYYYMMDD>          해시 봇→횟수        90일 보관
//     smilekey:bots:<YYYYMMDD>:paths    해시 봇|경로→횟수   45일 보관
// 조회: node infra/tmp/bot_report.mjs [일수] [smilekey|mitra]
import { NextResponse } from "next/server";

const PREFIX = "smilekey";

// 위에서부터 첫 일치가 라벨. 구체적인 것(OAI-SearchBot·GoogleOther)을 포괄적인 것(GPTBot·Googlebot)보다 앞에.
const BOTS = [
  // AI
  ["oai-search", /OAI-SearchBot/i],
  ["chatgpt-user", /ChatGPT-User/i],
  ["gptbot", /GPTBot/i],
  ["claude-user", /Claude-User|Claude-SearchBot/i],
  ["claudebot", /ClaudeBot|Claude-Web|anthropic-ai/i],
  ["perplexity-user", /Perplexity-User/i],
  ["perplexity", /PerplexityBot/i],
  ["google-other", /Google-Extended|GoogleOther/i],
  ["bytespider", /Bytespider/i],
  ["amazonbot", /Amazonbot/i],
  ["meta-ai", /meta-externalagent|FacebookBot/i],
  ["ccbot", /CCBot/i],
  ["mistral", /MistralAI-User/i],
  ["duckassist", /DuckAssistBot/i],
  ["cohere", /cohere-ai/i],
  ["youbot", /YouBot/i],
  // 검색
  ["googlebot", /Googlebot/i],
  ["bingbot", /bingbot/i],
  ["yeti", /Yeti/i],
  ["applebot", /Applebot/i],
  ["duckduckbot", /DuckDuckBot/i],
  ["yandex", /YandexBot/i],
  ["daum", /Daum/i],
  // 미리보기(메신저·SNS 링크 카드)
  ["fb-preview", /facebookexternalhit/i],
  ["kakao", /kakaotalk-scrap/i],
  ["twitter", /Twitterbot/i],
  ["slack", /Slackbot/i],
  ["telegram", /TelegramBot/i],
];

function classify(ua) {
  for (const [label, re] of BOTS) if (re.test(ua)) return label;
  return null;
}

function kstDay() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, "");
}

export function middleware(req, event) {
  const bot = classify(req.headers.get("user-agent") || "");
  if (!bot) return NextResponse.next();

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    const day = kstDay();
    const path = req.nextUrl.pathname.slice(0, 120);
    const k = `${PREFIX}:bots:${day}`;
    const kp = `${k}:paths`;
    const body = JSON.stringify([
      ["HINCRBY", k, bot, "1"],
      ["EXPIRE", k, "7776000"],
      ["HINCRBY", kp, `${bot}|${path}`, "1"],
      ["EXPIRE", kp, "3888000"],
    ]);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    event.waitUntil(
      fetch(`${url.replace(/\/$/, "")}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body,
        signal: ctrl.signal,
      })
        .catch(() => {})
        .finally(() => clearTimeout(timer)),
    );
  }
  const res = NextResponse.next();
  res.headers.set("x-bot", bot); // curl 검증용
  return res;
}

// 정적 자산·API는 제외. llms.txt·sitemap.xml·robots.txt는 AI 봇이 읽는 대상이라 포함(txt/xml은 제외하지 않음).
export const config = {
  matcher: ["/((?!_next/|api/|favicon\\.ico|.*\\.(?:png|jpe?g|gif|svg|ico|webp|avif|css|js|map|woff2?|ttf|otf)$).*)"],
};
