// lib/ai.js
import OpenAI from "openai";

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

// 대구 소식 정보글 작성 — 후보 기사 목록에서 주제 1개 골라 밝은 톤의 정보글 생성
export async function aiWriteDaeguPost({ candidates, today }) {
  const client = getClient();
  if (!client) return null;

  const list = candidates
    .map(
      (c, i) =>
        `${i + 1}. [${c.type}] ${c.title} (${c.date || "날짜미상"})\n   ${c.description}\n   링크: ${c.link}`
    )
    .join("\n");

  const prompt = `
너는 대구 지역 생활정보 블로그의 편집자야. 오늘은 ${today}.
아래 후보 기사/포스트 목록에서 대구 시민·방문객에게 가장 유용하고 재미있는 주제 1개를 골라,
밝고 친근한 톤의 정보글을 한국어로 작성해라. 축제·행사·핫플·트렌드 우선.

규칙:
- 후보 목록에 실제로 있는 정보만 사용. 목록에 없는 날짜/장소/가격을 지어내지 마라.
- 같은 주제를 다루는 후보가 여러 개면 묶어서 하나의 글로.
- 확실하지 않은 정보는 "~로 알려져 있어요", "방문 전 확인이 필요해요"로 표현.
- 인사말·자기소개·광고 문구 금지. 본문은 바로 내용으로 시작.
- 섹션 2~4개. 각 섹션 본문은 2~4문장.
- 이모지는 전체에서 최대 2개.
- used_links에는 실제로 참고한 후보의 링크만 넣어라(최소 1개).
- 출력은 JSON만 (추가 텍스트 금지).

형식:
{"title":"글 제목","hook":"한 줄 소개(60자 이내)","sections":[{"heading":"소제목","body":"본문"}],"tags":["태그1","태그2","태그3"],"used_links":["..."]}

후보 목록:
${list}
`.trim();

  try {
    const r = await client.responses.create({
      model: "gpt-4o-mini",
      input: prompt,
      max_output_tokens: 1600,
      store: false,
    });

    const text = (r.output_text || "").trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("aiWriteDaeguPost JSON not found:", text.slice(0, 300));
      return null;
    }

    let obj;
    try {
      obj = JSON.parse(jsonMatch[0]);
    } catch {
      console.error("aiWriteDaeguPost JSON parse failed:", text.slice(0, 300));
      return null;
    }

    if (!obj.title || !Array.isArray(obj.sections) || !obj.sections.length) return null;

    return {
      title: String(obj.title).trim(),
      hook: String(obj.hook || "").trim(),
      sections: obj.sections
        .filter((s) => s && s.heading && s.body)
        .map((s) => ({ heading: String(s.heading).trim(), body: String(s.body).trim() })),
      tags: Array.isArray(obj.tags) ? obj.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 6) : [],
      used_links: Array.isArray(obj.used_links) ? obj.used_links.filter(Boolean) : [],
    };
  } catch (e) {
    console.error("aiWriteDaeguPost error:", e);
    return null;
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
