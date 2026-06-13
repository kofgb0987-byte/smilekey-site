// lib/ai.js
import OpenAI from "openai";

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
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
