// lib/ai.js
import OpenAI from "openai";

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

// 대구 소식 정보글 작성 — 후보 기사 목록에서 주제 1개 골라 밝은 톤의 정보글 생성
export async function aiWriteDaeguPost({ candidates, today, recentTitles = [] }) {
  const client = getClient();
  if (!client) return null;

  const list = candidates
    .map(
      (c, i) =>
        `${i + 1}. [${c.type}] ${c.title} (${c.date || "날짜미상"})\n   ${c.description}\n   링크: ${c.link}`
    )
    .join("\n");

  const recentBlock = recentTitles.length
    ? `\n이미 발행한 글 제목 (아래와 같은 행사/사건을 다루는 주제는 다른 기사라도 선택 금지):\n${recentTitles
        .map((t) => `- ${t}`)
        .join("\n")}\n`
    : "";

  const prompt = `
너는 대구 지역 생활정보 블로그의 편집자야. 오늘은 ${today}.
아래 후보 기사/포스트 목록에서 대구 시민·방문객에게 가장 유용하고 재미있는 주제 1개를 골라,
밝고 친근한 톤의 정보글을 한국어로 작성해라.

주제 우선순위 (위에서부터):
1. **오늘~며칠 내 개최되거나 지금 진행 중인 축제·행사** — 기사 날짜가 며칠 지났어도 행사가 임박했으면 최우선
2. 앞으로 열릴 예정인 축제·행사·전시
3. 핫플레이스·트렌드·재미있는 지역 소식

주제 선택 규칙 (가장 중요):
- 반드시 **서로 다른 언론사의 후보 2개 이상**이 같은 사건/행사를 다루는 주제만 선택하라.
  단 하나의 기사만 다루는 주제는 아무리 재미있어도 선택 금지.
  단, [official] 후보(공공기관 공식 발표/행사데이터)는 신뢰도가 높으므로 **단독 근거로도 선택 가능**하다.
  [official]의 행사기간·장소는 공식 데이터이므로 그대로 써도 된다.
- 후보의 날짜는 "기사 작성일"이지 행사 날짜가 아니다. 절대 혼동하지 마라.
- 이미 종료된 행사, 과거 회고("다녀왔다", "성황리에 마쳤다"), 칼럼/기고/오피니언은 주제로 삼지 마라.
  종료 여부가 불확실하면 그 주제는 피해라.
- 어떤 행사의 후보가 전부 **사후 결과 보도**(방문객 수 집계, "열렸다"·"찾았다" 같은 과거형 개최 서술,
  축하 방문 포토 기사)뿐이면 그 행사는 이미 끝난 것이다 — 선택 금지.
- "이미 발행한 글 제목" 목록과 같은 행사/사건을 다루는 주제는 선택 금지. 새 주제가 없으면 skip하라.
- 조건을 만족하는 주제가 하나도 없으면 {"skip":true,"reason":"이유"}만 출력하라.

작성 규칙:
- 후보 목록에 실제로 있는 정보만 사용. 목록에 없는 날짜/장소/가격을 지어내지 마라.
- 행사 시작·종료 날짜는 후보 본문에 명시된 경우에만 쓰고, 없으면 날짜를 단정하지 말고
  "일정은 방문 전 공식 안내를 확인해 주세요"로 표현하라.
- 확실하지 않은 정보는 "~로 알려져 있어요" 같은 유보 표현.
- 인사말·자기소개·광고 문구 금지. 본문은 바로 내용으로 시작.
- 섹션 2~4개. 각 섹션 본문은 2~4문장.
- 이모지는 전체에서 최대 2개.
- used_links에는 실제로 근거로 삼은 후보의 링크를 모두 넣어라(서로 다른 언론사 최소 2개).
- 출력은 JSON만 (추가 텍스트 금지).

형식:
{"title":"글 제목","hook":"한 줄 소개(60자 이내)","sections":[{"heading":"소제목","body":"본문"}],"tags":["태그1","태그2","태그3"],"used_links":["...","..."]}
${recentBlock}
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

    if (obj.skip) return { skip: true, reason: String(obj.reason || "조건 만족 주제 없음") };
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

// 발행 전 검수 — 초안의 사실 주장이 근거 후보로 뒷받침되는지, 종료된 행사가 아닌지 확인
export async function aiReviewDaeguPost({ post, candidates, today }) {
  const client = getClient();
  if (!client) return { approved: true, issues: [] }; // 검수 불가 시 통과(작성 자체가 이미 성공한 상태)

  const usedSet = new Set(post.used_links);
  const evidence = candidates
    .filter((c) => usedSet.has(c.link))
    .map((c) => `- [${c.date}] ${c.title}\n  ${c.description}`)
    .join("\n");

  const draft = [
    `제목: ${post.title}`,
    `소개: ${post.hook}`,
    ...post.sections.map((s) => `${s.heading}: ${s.body}`),
  ].join("\n");

  const prompt = `
너는 팩트체커야. 오늘은 ${today}. 아래 네 가지 질문에만 답해라. 승인/거부 판단은 하지 마라.

질문 1 — ended_evidence: 근거 목록 원문에 이 행사가 **이미 끝났다는 명시적 표현**
("마쳤다", "폐막", "성황리에 종료", 오늘 이전의 종료일 등)이 실제로 있는가?
있으면 그 표현을 그대로 인용하라. 없으면 null. **추측 금지 — 인용할 문구가 없으면 무조건 null.**

질문 2 — retro_evidence: 근거 기사들이 **하나도 빠짐없이 전부** 행사 결과를 사후에 전하는 보도
(방문객 수 집계, "열렸다"·"찾았다" 같은 과거형 개최 서술, 축하 방문 포토 기사)인가?
전부 그렇다면 그중 한 표현을 그대로 인용하라. 예고·안내·예매·"개최 예정"·진행 중 보도가
**하나라도** 있으면 null.

질문 3 — event_end_date: 근거 원문에 행사 **종료일이 명시**되어 있으면 "YYYY-MM-DD"로 적어라.
없으면 null. **추측·계산 금지 — 원문에 날짜가 없으면 무조건 null.**

질문 4 — unsupported_claims: 초안이 **단정적으로** 서술한 구체적 사실(날짜·장소·가격·프로그램) 중
근거 목록에 없는 것을 나열하라. 초안이 "공식 안내 확인", "~로 알려져 있어요"처럼
유보한 항목과, 상식 수준의 일반 서술은 포함하지 마라. 없으면 빈 배열.

출력은 JSON만:
{"ended_evidence": "인용문" 또는 null, "retro_evidence": "인용문" 또는 null, "event_end_date": "YYYY-MM-DD" 또는 null, "unsupported_claims": ["주장1", ...]}

[초안]
${draft}

[근거 목록]
${evidence}
`.trim();

  try {
    const r = await client.responses.create({
      model: "gpt-4o-mini",
      input: prompt,
      max_output_tokens: 500,
      store: false,
    });
    const jsonMatch = (r.output_text || "").match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { approved: true, issues: [] };
    const obj = JSON.parse(jsonMatch[0]);

    // 판정은 코드가: 종료 증거·사후보도만 존재·종료일 경과·근거 없는 단정 주장일 때만 거부
    const issues = [];
    if (obj.ended_evidence && String(obj.ended_evidence).trim().length > 3) {
      issues.push(`행사 종료 증거: ${obj.ended_evidence}`);
    }
    if (obj.retro_evidence && String(obj.retro_evidence).trim().length > 3) {
      issues.push(`사후 결과 보도만 존재(행사 종료 추정): ${obj.retro_evidence}`);
    }
    const endDate = typeof obj.event_end_date === "string" ? obj.event_end_date.trim() : "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(endDate) && endDate < today) {
      issues.push(`행사 종료일 경과: ${endDate}`);
    }
    const claims = Array.isArray(obj.unsupported_claims)
      ? obj.unsupported_claims.map(String).filter((s) => s.trim())
      : [];
    if (claims.length) issues.push(...claims.map((c) => `근거 없는 단정: ${c}`));

    return { approved: issues.length === 0, issues };
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
