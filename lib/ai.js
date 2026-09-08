// lib/ai.js — OpenAI 백엔드 (서버 폴백 경로)
//
// 대구 소식 정규 발행은 2026-09-08부터 집 서버 scripts/daegu-write.mjs(구독 claude -p)가 한다.
// 여기 aiWriteDaeguPost/aiReviewDaeguPost는 로컬 작성기가 죽었을 때 daegu-post.js가 쓰는 폴백.
// 프롬프트는 lib/daegu-prompts.mjs 한 곳에서 가져온다 — 두 경로가 다른 글을 쓰지 않게.
import OpenAI from "openai";
import {
  buildWritePrompt,
  buildReviewPrompt,
  extractJson,
  normalizeDraft,
  judgeReview,
} from "./daegu-prompts.mjs";

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  // SDK 기본값(타임아웃 10분·재시도 2회)은 크론 300s 한도를 잡아먹는다 — 짧게 강제
  return new OpenAI({ apiKey, timeout: 60000, maxRetries: 1 });
}

// 대구 소식 정보글 작성 — 후보 기사 목록에서 주제 1개 골라 밝은 톤의 정보글 생성
export async function aiWriteDaeguPost({ candidates, today, recentTitles = [] }) {
  const client = getClient();
  if (!client) return null;

  const prompt = buildWritePrompt({ candidates, today, recentTitles });

  try {
    const r = await client.responses.create({
      model: "gpt-4o-mini",
      input: prompt,
      max_output_tokens: 2500,
      text: { format: { type: "json_object" } }, // 후보 400+ 장문 프롬프트에서 출력 잘림/잡담 방지
      store: false,
    });

    const text = (r.output_text || "").trim();
    const obj = extractJson(text);
    if (!obj) {
      console.error("aiWriteDaeguPost JSON not found:", text.slice(0, 300));
      return { error: `JSON 없음 (status=${r.status || "?"}, incomplete=${r.incomplete_details?.reason || "no"}, len=${text.length})` };
    }
    return normalizeDraft(obj);
  } catch (e) {
    console.error("aiWriteDaeguPost error:", e);
    return { error: `API 오류: ${String(e.message || e).slice(0, 200)}` };
  }
}

// 발행 전 검수 — 초안의 사실 주장이 근거 후보로 뒷받침되는지, 종료된 행사가 아닌지 확인
export async function aiReviewDaeguPost({ post, candidates, today }) {
  const client = getClient();
  if (!client) return { approved: true, issues: [] }; // 검수 불가 시 통과(작성 자체가 이미 성공한 상태)

  const prompt = buildReviewPrompt({ post, candidates, today });

  try {
    const r = await client.responses.create({
      model: "gpt-4o-mini",
      input: prompt,
      max_output_tokens: 500,
      store: false,
    });
    // 판정은 코드가: 종료 증거·사후보도만 존재·종료일 경과·근거 없는 단정 주장일 때만 거부
    return judgeReview(extractJson(r.output_text || ""), today);
  } catch (e) {
    console.error("aiReviewDaeguPost error:", e);
    return { approved: true, issues: [] };
  }
}

export async function aiSummarize3({ title, baseSummary, bodyText, source, date }) {
  const client = getClient();
  if (!client) return null;

  const bodySection = bodyText
    ? `\n본문 (노이즈 제거 후):\n${bodyText}`
    : "";

  const prompt = `
너는 자동차키/스마트키/도어락 업체의 작업요약 편집자야.
아래 정보를 바탕으로 3~4문장 요약을 3개 언어로 만들어라.
- ko: 한국어
- en: English
- zh: 中文(简体)

규칙:
- 차종, 작업 내용, 특이사항 위주로 서술
- 날씨/인사말/광고성 문구 제거
- 사실만, 과장 금지
- ko에는 "대구" 1회 포함
- 출력은 JSON만 (추가 텍스트 금지)

형식:
{"ko":"...","en":"...","zh":"..."}

입력:
제목: ${title}
출처: ${source}
날짜: ${date}
초안: ${baseSummary}${bodySection}
`.trim();

  try {
    const r = await client.responses.create({
      model: "gpt-4o-mini",
      input: prompt,
      max_output_tokens: 800,
      store: false,
    });

    const text = (r.output_text || "").trim();
    if (!text) return null;

    // JSON 블록만 추출 (```json ... ``` 형태 대응)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("AI JSON not found:", text);
      return null;
    }

    let obj;
    try {
      obj = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error("AI JSON parse failed:", text);
      return null;
    }

    return {
      ko: (obj.ko || "").trim(),
      en: (obj.en || "").trim(),
      zh: (obj.zh || "").trim(),
    };
  } catch (e) {
    console.error("aiSummarize3 error:", e);
    return null;
  }
}
