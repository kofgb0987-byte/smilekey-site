import OpenAI from "openai";

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

export async function aiSummarize3({ title, baseSummary, source, date }) {
  const client = getClient();
  if (!client) return null; // ✅ 키 없으면 그냥 스킵

  const prompt = `
너는 자동차키/스마트키/도어락 업체의 작업요약 편집자야.
아래 정보를 바탕으로 2~3문장 요약을 3개 언어로 만들어라.
- ko: 한국어
- en: English
- zh: 中文(简体)
규칙:
- 날씨/인사말 제거
- 사실만, 과장 금지
- ko에는 "대구" 1회 포함
- 출력은 JSON만 (추가 텍스트 금지)
형식:
{"ko":"...","en":"...","zh":"..."}

입력:
제목: ${title}
출처: ${source}
날짜: ${date}
초안요약: ${baseSummary}
`.trim();

  try {
    const r = await client.responses.create({
      model: "gpt-5-mini",

  reasoning: { effort: "low" },
      input: prompt,
  max_output_tokens: 800,
  store: false,
    });

    const text = (r.output_text || "").trim();


if (!text) {
  return null;
}

let obj;
try {
  obj = JSON.parse(text);
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
    return null; // ✅ 크레딧 부족/실패여도 크론이 죽지 않게
  }
}
