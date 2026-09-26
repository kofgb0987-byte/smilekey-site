#!/usr/bin/env node
// scripts/guide-write.mjs — 작업 아카이브 근거 가이드 글 생성기 (집 서버, Claude Code 구독 인증)
//
//   node scripts/guide-write.mjs --count                 주제별 근거 사례 수만 출력(모델 호출 없음)
//   node scripts/guide-write.mjs [--slug a,b] [--dry] [--force] [--concurrency 2] [--model opus]
//   node scripts/guide-write.mjs --fix [--slug a,b]      기존 글의 남은 검수 지적만 재수정·재검수(최대 2라운드)
//
// 흐름(주제당): 아카이브에서 근거 사례 선별 → 작성 → 근거 대조 검수 → 지적 반영 수정 → 파일 저장
//   content/guide/posts/<slug>.json  (주제별, git 검토용)
//   content/guide/posts.json         (전체 묶음 — 페이지가 정적 import)
//   content/guide/index.json         (목록·링크용 요약)
// 게시는 이 스크립트가 하지 않는다. 파일을 커밋·배포해야 사이트에 올라간다.
//
// 아카이브 읽기: 로컬 SRH(http://localhost:8078, 토큰 infra/wsl/smilekey/srh.env) 읽기 전용.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const CONTENT = path.join(ROOT, "content", "guide");
const POSTS_DIR = path.join(CONTENT, "posts");
const SRH = process.env.SRH_URL || "http://localhost:8078";

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d; };
const model = String(opt("model", "opus"));
const dry = flag("dry");
const force = flag("force");
const countOnly = flag("count");
const fixOnly = flag("fix"); // 기존 글의 남은 검수 지적만 다시 수정·재검수(최대 2라운드)
const concurrency = Math.max(1, parseInt(opt("concurrency", "2"), 10) || 2);
const onlySlugs = opt("slug", "") ? String(opt("slug", "")).split(",").map((s) => s.trim()).filter(Boolean) : null;
const MAX_EVIDENCE = 16;
const AI_TAG = `claude-${model}(sub)`;

const topics = JSON.parse(fs.readFileSync(path.join(CONTENT, "topics.json"), "utf8")).topics;
const facts = JSON.parse(fs.readFileSync(path.join(CONTENT, "facts.json"), "utf8"));
const log = (...a) => console.error(new Date().toISOString().slice(11, 19), ...a);

// ---------- 아카이브 ----------
function srhToken() {
  const f = path.resolve(ROOT, "..", "infra", "wsl", "smilekey", "srh.env");
  const m = fs.readFileSync(f, "utf8").match(/SRH_TOKEN=(.+)/);
  if (!m) throw new Error("srh.env에 SRH_TOKEN 없음");
  return m[1].trim().replace(/["\r]/g, "");
}
async function srh(pathname, body, tok) {
  const r = await fetch(SRH + pathname, { method: "POST", headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}
const toObj = (flat) => { if (!Array.isArray(flat)) return flat; const o = {}; for (let i = 0; i < flat.length; i += 2) o[flat[i]] = flat[i + 1]; return o; };
const parseDate = (d) => { const t = Date.parse(d); return isNaN(t) ? "" : new Date(t).toISOString().slice(0, 10); };

async function loadArchive() {
  const tok = srhToken();
  const ids = (await srh("", ["SMEMBERS", "smilekey:summary_ids:v1"], tok)).result || [];
  const recs = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const res = await srh("/pipeline", chunk.map((id) => ["HGETALL", "smilekey:summary:" + id]), tok);
    res.forEach((r, j) => { const o = toObj(r.result); if (o && o.title) recs.push({ id: chunk[j], ...o, dateIso: parseDate(o.date) }); });
  }
  recs.sort((a, b) => b.dateIso.localeCompare(a.dateIso));
  return recs;
}

// ---------- 근거 선별 ----------
const text = (r) => `${r.title || ""} ${r.summary_ko || ""}`;
const normTitle = (t) => String(t).replace(/\[.*?\]/g, "").replace(/대구|중앙열쇠|경산|청도|진량|현풍|하양|영천|출장|전문|하는곳|#\S+/g, "").replace(/[^0-9A-Za-z가-힣]/g, "").slice(0, 10);

function pickEvidence(topic, recs) {
  const re = new RegExp(topic.match, "i");
  const ex = topic.exclude ? new RegExp(topic.exclude, "i") : null; // 주제와 무관한 잡음 사례 제외(툴레 루프박스 등)
  const hits = recs.filter((r) => re.test(text(r)) && !(ex && ex.test(text(r))));
  // 같은 모델 글이 근거를 독점하지 않게 제목 앞부분 기준으로 1차 중복 제거, 부족하면 채움
  const seen = new Set();
  const picked = [];
  for (const r of hits) { const k = normTitle(r.title); if (seen.has(k)) continue; seen.add(k); picked.push(r); if (picked.length >= MAX_EVIDENCE) break; }
  if (picked.length < MAX_EVIDENCE) for (const r of hits) { if (picked.length >= MAX_EVIDENCE) break; if (!picked.includes(r)) picked.push(r); }
  return { hits: hits.length, picked };
}
const evidenceText = (picked) => picked.map((r, i) => `[${i + 1}] ${r.dateIso.slice(0, 7)} | ${String(r.title).trim()}\n    요약: ${String(r.summary_ko || "").trim()}`).join("\n");

// ---------- 프롬프트 ----------
// 사장님이 확인한 사실(facts.json importedKey · models.json noCopyWithoutKey)은 근거 사례 밖이어도 써도 된다.
// 수입차 주제(topics.json imported=true)와 예비키 글에만 넣는다. 페이지에는 ImportedKeyNotice 상자로도 붙으니 본문은 한두 문장이면 충분.
const models = JSON.parse(fs.readFileSync(path.join(CONTENT, "models.json"), "utf8"));
function ownerFacts(topic) {
  if (!(topic.imported || topic.slug === "spare-key")) return "";
  const lines = [];
  if (facts.importedKey && facts.importedKey.confirmed) lines.push(`- 사장님이 확인한 사실이라 한두 문장으로 녹여도 된다(이 문장 안의 "한 달 가까이"는 숫자 금지 예외): "${facts.importedKey.text}"`);
  const noCopy = (models.noCopyWithoutKey || []).filter((m) => m.confirmed !== false && (m.guide === topic.slug || topic.slug === "imported-premium" || topic.slug === "spare-key"));
  if (noCopy.length) lines.push(`- 사장님 확인: 기존 키가 없으면 복사가 안 되는 차종 = ${noCopy.map((m) => `${m.brand} ${m.model}${m.years ? `(${m.years})` : ""}`).join(", ")} — 키를 전부 잃어버리면 현장 제작이 어려워 서비스센터 경로. 이 사실은 써도 된다.`);
  return lines.length ? "\n" + lines.join("\n") : "";
}
function writePrompt(topic, picked) {
  return `
너는 smilekey.me(${facts.business}, 자동차키·스마트키 전문) 사이트의 편집자야.
이 글의 주제는 "${topic.name}"이고, 독자는 "${topic.query}"를 검색한 사람이다. 초점: ${topic.angle}
아래 [근거 사례]는 이 가게가 실제로 한 작업 기록이다. 읽고 바로 전화하게 만드는 안내글을 한국어로 써라.

작성 규칙 (가장 중요):
- 가게에 관한 구체적 사실(대응 차종·모델, 현장 제작 여부, 등록까지 했는지, 수리 내용)은 **[근거 사례]에 있는 것만** 써라.
  사례에 없는 모델·브랜드를 "가능하다"고 단정하지 마라. 사례별로 기록된 만큼만("제작", "제작·등록", "잠금 해제") 써라.
- **가격·비용·소요시간·보증기간 숫자는 절대 쓰지 마라.** 비용은 "차종과 키 종류에 따라 달라 전화로 안내"로만.
- 출장 지역은 "${facts.area.text}"로만 써라. 영업시간·24시간 표현은 쓰지 마라.
- 일반 상식(보험 긴급출동은 문 열기까지인 경우가 많다, 서비스센터는 견인·대기가 필요할 수 있다, 배터리는 먼저 바꿔볼 수 있다 등)은
  "보통", "일반적으로", "경우가 많다"로 유보해서 써라. 단정 금지. 이런 일반론은 이 글 주제와 직접 관련된 것만 2~3문장 이내.
- 다른 가이드와 겹치는 차키 분실 일반 대처법은 반복하지 말고 이 주제 특유의 내용에 집중해라.
- "실제 사례" 섹션을 반드시 하나 넣고, 근거 사례의 모델을 5개 이상 구체적으로 언급해라. 시기는 연·월까지만.
- 독자에게 요구할 정보는 차종·연식·차량번호·차량 위치 정도로 제한하고 "알려주시면 상담이 빠르다" 수준으로.
- 인사말·자기소개·과장·최상급 금지. 본문은 바로 내용으로 시작. 이모지 최대 1개.
- 마지막 섹션은 연락 안내: 전화 ${facts.phone}${facts.sms.allowed ? ", 통화가 어려우면 같은 번호로 문자" : ""}.${ownerFacts(topic)}
- 제목은 60자 이내, "${topic.query}"의 핵심어를 포함. 다른 주제 글과 구분되게 이 주제의 상황·차종이 제목에 드러나야 한다.
- faq는 이 주제에서 독자가 실제로 물을 법한 질문 2~3개. 답도 위 규칙(근거 범위·숫자 금지·유보 표현)을 따른다.
- 출력은 JSON만. 추가 텍스트 금지.

형식:
{"title":"...","hook":"한 줄 소개(70자 이내)","sections":[{"heading":"...","body":"..."}],"faq":[{"q":"...","a":"..."}],"tags":["...","..."],"used_cases":[1,2]}
섹션은 4~5개, 각 2~4문장.

[근거 사례]
${evidenceText(picked)}
`.trim();
}

const draftText = (d) => [`제목: ${d.title}`, `소개: ${d.hook}`, ...d.sections.map((s) => `${s.heading}: ${s.body}`), ...(d.faq || []).map((f) => `Q: ${f.q}\nA: ${f.a}`)].join("\n");

function reviewPrompt(draft, picked) {
  return `
너는 팩트체커야. [초안]은 자동차키 가게 사이트의 안내글, [근거 사례]는 그 가게의 실제 작업 기록이다. 두 가지만 찾아 JSON으로 답해라.
1. unsupported_claims: 초안이 **가게에 대해 단정적으로** 말한 구체적 사실(대응 차종·모델, 절차, 등록·시동 여부, 출장 지역, 영업시간)
   중 [근거 사례]에 없거나 기록보다 부풀린 것. "보통·일반적으로·경우가 많다"로 유보한 일반 상식 문장과
   "${facts.area.text}" 문장, 전화·문자 안내 문장은 제외. 없으면 빈 배열.
2. numbers: 가격·비용·소요시간·보증 관련 숫자 표현이 있으면 그대로 인용. 없으면 빈 배열.
   단 제조사 서비스센터 소요를 말하는 "한 달 가까이"(사장님 확인 문장)는 제외.
출력: {"unsupported_claims":["..."],"numbers":["..."]}

[초안]
${draftText(draft)}

[근거 사례]
${evidenceText(picked)}
`.trim();
}

function revisePrompt(draft, review, picked) {
  return `
아래 [초안]을 [검수 지적]대로만 고쳐서 같은 JSON 형식으로 다시 출력해라. 지적되지 않은 문장은 바꾸지 마라.
원칙: 근거 사례에 기록된 범위로 표현을 줄인다. 새 사실을 추가하지 않는다. 숫자(가격·시간·보증)는 삭제하거나 "전화로 안내"로 바꾼다.
출력은 JSON만: {"title":"...","hook":"...","sections":[...],"faq":[...],"tags":[...],"used_cases":[...]}

[검수 지적]
${[...(review.unsupported_claims || []).map((c) => "- 근거 없음: " + c), ...(review.numbers || []).map((n) => "- 숫자 삭제: " + n)].join("\n")}

[초안]
${JSON.stringify(draft)}

[근거 사례]
${evidenceText(picked)}
`.trim();
}

// ---------- claude -p ----------
function runClaude(prompt) {
  const cmd = process.platform === "win32" ? "claude.cmd" : "claude";
  const args = ["-p", "--model", model, "--output-format", "text", "--tools", '""', "--no-session-persistence"];
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: ROOT, env: process.env, shell: true, stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error("claude 타임아웃(300s)")); }, 300000);
    child.stdout.on("data", (d) => (out += d.toString("utf8")));
    child.stderr.on("data", (d) => (err += d.toString("utf8")));
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code) => { clearTimeout(timer); if (code !== 0 && !out.trim()) return reject(new Error(`claude exited ${code}: ${err.slice(0, 300)}`)); resolve(out); });
    child.stdin.end(prompt, "utf8");
  });
}
const extractJson = (t) => { const m = String(t || "").match(/\{[\s\S]*\}/); if (!m) return null; try { return JSON.parse(m[0]); } catch { return null; } };
function normalize(o) {
  if (!o || !o.title || !Array.isArray(o.sections) || !o.sections.length) return null;
  return {
    title: String(o.title).trim(),
    hook: String(o.hook || "").trim(),
    sections: o.sections.filter((s) => s && s.heading && s.body).map((s) => ({ heading: String(s.heading).trim(), body: String(s.body).trim() })),
    faq: Array.isArray(o.faq) ? o.faq.filter((f) => f && f.q && f.a).map((f) => ({ q: String(f.q).trim(), a: String(f.a).trim() })).slice(0, 3) : [],
    tags: Array.isArray(o.tags) ? o.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 8) : [],
    used_cases: Array.isArray(o.used_cases) ? o.used_cases.map(Number).filter((n) => Number.isInteger(n)) : [],
  };
}
// 숫자 백스톱 — 모델 검수가 놓쳐도 코드가 잡는다(원·분·시간·일·%·만원)
const NUM_RE = /(\d[\d,]*\s*(원|만원|만 원|분|시간|일|주|개월|년|%|퍼센트))|([0-9]+\s*~\s*[0-9]+)/g;
const numbersIn = (d) => (draftText(d).match(NUM_RE) || []).filter((m) => !/^\d{4}년/.test(m));

// ---------- 주제 1건 처리 ----------
async function processTopic(topic, recs) {
  const { hits, picked } = pickEvidence(topic, recs);
  const out = path.join(POSTS_DIR, `${topic.slug}.json`);
  if (hits < (topic.minCases || 1)) { log(`[${topic.slug}] 건너뜀: 근거 ${hits}건 < ${topic.minCases}`); return { slug: topic.slug, skipped: `근거 부족 ${hits}` }; }
  if (!force && !dry && fs.existsSync(out)) { log(`[${topic.slug}] 이미 있음(--force로 재생성)`); return { slug: topic.slug, existing: true }; }

  const t0 = Date.now();
  log(`[${topic.slug}] 근거 ${picked.length}/${hits}건, 작성 중...`);
  let draft = normalize(extractJson(await runClaude(writePrompt(topic, picked))));
  if (!draft) throw new Error(`[${topic.slug}] 작성 결과 파싱 실패`);

  log(`[${topic.slug}] 초안 "${draft.title}" — 검수 중...`);
  const review1 = extractJson(await runClaude(reviewPrompt(draft, picked))) || { unsupported_claims: [], numbers: [] };
  review1.numbers = [...new Set([...(review1.numbers || []), ...numbersIn(draft)])];

  let final = draft;
  let review2 = null;
  if ((review1.unsupported_claims || []).length || review1.numbers.length) {
    log(`[${topic.slug}] 지적 ${review1.unsupported_claims.length}건·숫자 ${review1.numbers.length}건 — 수정 중...`);
    const revised = normalize(extractJson(await runClaude(revisePrompt(draft, review1, picked))));
    if (revised) {
      final = revised;
      review2 = extractJson(await runClaude(reviewPrompt(final, picked))) || { unsupported_claims: [], numbers: [] };
      review2.numbers = [...new Set([...(review2.numbers || []), ...numbersIn(final)])];
    }
  }

  const post = {
    slug: topic.slug,
    name: topic.name,
    query: topic.query,
    service: topic.service,
    group: topic.group,
    ...final,
    evidence: picked.map((r, i) => ({ n: i + 1, id: r.id, date: r.dateIso, title: r.title })),
    evidence_hits: hits,
    review: { first: review1, after_revise: review2 },
    revised: !!review2,
    ai_model: AI_TAG,
    generated_at: new Date().toISOString(),
  };
  const remaining = review2 ? (review2.unsupported_claims || []).length + review2.numbers.length : (review1.unsupported_claims || []).length + review1.numbers.length;
  log(`[${topic.slug}] 완료 ${Math.round((Date.now() - t0) / 1000)}s — 남은 지적 ${remaining}건`);

  if (dry) { console.log(JSON.stringify(post, null, 2)); return { slug: topic.slug, dry: true, remaining }; }
  fs.mkdirSync(POSTS_DIR, { recursive: true });
  fs.writeFileSync(out, JSON.stringify(post, null, 2), "utf8");
  return { slug: topic.slug, title: final.title, remaining };
}

// ---------- 기존 글 재수정 (--fix) ----------
const flagCount = (r) => (r ? (r.unsupported_claims || []).length + (r.numbers || []).length : 0);

async function fixTopic(topic, recs) {
  const file = path.join(POSTS_DIR, `${topic.slug}.json`);
  if (!fs.existsSync(file)) return { slug: topic.slug, skipped: "글 없음" };
  const post = JSON.parse(fs.readFileSync(file, "utf8"));
  let review = post.review?.after_revise || post.review?.first;
  if (!flagCount(review)) return { slug: topic.slug, remaining: 0, untouched: true };

  // 근거는 생성 당시 사례 그대로(id로 복원) — 검수 기준이 흔들리지 않게
  const byId = new Map(recs.map((r) => [r.id, r]));
  const picked = (post.evidence || []).map((e) => byId.get(e.id)).filter(Boolean);
  if (picked.length < 3) return { slug: topic.slug, skipped: "근거 복원 실패" };

  let final = normalize(post);
  const history = post.review?.fix_rounds || [];
  const t0 = Date.now();
  for (let round = 1; round <= 2 && flagCount(review); round++) {
    log(`[${topic.slug}] 재수정 ${round}라운드 — 지적 ${flagCount(review)}건`);
    const revised = normalize(extractJson(await runClaude(revisePrompt(final, review, picked))));
    if (!revised) break;
    final = revised;
    review = extractJson(await runClaude(reviewPrompt(final, picked))) || { unsupported_claims: [], numbers: [] };
    review.numbers = [...new Set([...(review.numbers || []), ...numbersIn(final)])];
    history.push({ round: history.length + 1, remaining: flagCount(review), review });
  }
  const updated = { ...post, ...final, review: { ...post.review, after_revise: review, fix_rounds: history }, revised: true, fixed_at: new Date().toISOString() };
  fs.writeFileSync(file, JSON.stringify(updated, null, 2), "utf8");
  log(`[${topic.slug}] 재수정 완료 ${Math.round((Date.now() - t0) / 1000)}s — 남은 지적 ${flagCount(review)}건`);
  return { slug: topic.slug, title: final.title, remaining: flagCount(review) };
}

// ---------- 묶음 파일 ----------
function rebuildBundles() {
  if (!fs.existsSync(POSTS_DIR)) return 0;
  const posts = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(POSTS_DIR, f), "utf8")));
  const order = new Map(topics.map((t, i) => [t.slug, i]));
  posts.sort((a, b) => (order.get(a.slug) ?? 99) - (order.get(b.slug) ?? 99));
  fs.writeFileSync(path.join(CONTENT, "posts.json"), JSON.stringify(posts, null, 1), "utf8");
  const index = posts.map((p) => ({ slug: p.slug, name: p.name, title: p.title, hook: p.hook, query: p.query, service: p.service, group: p.group, evidence_hits: p.evidence_hits, generated_at: p.generated_at }));
  fs.writeFileSync(path.join(CONTENT, "index.json"), JSON.stringify(index, null, 1), "utf8");
  return posts.length;
}

// ---------- 본체 ----------
(async () => {
  const recs = await loadArchive();
  log(`아카이브 ${recs.length}건 (${recs[recs.length - 1]?.dateIso} ~ ${recs[0]?.dateIso})`);
  const targets = topics.filter((t) => !onlySlugs || onlySlugs.includes(t.slug));

  if (countOnly) {
    console.log("slug\t근거\t최소\t판정\t대표 사례");
    for (const t of targets) { const { hits, picked } = pickEvidence(t, recs); console.log(`${t.slug}\t${hits}\t${t.minCases}\t${hits >= t.minCases ? "OK" : "부족"}\t${String(picked[0]?.title || "").slice(0, 50)}`); }
    return;
  }

  const results = [];
  let idx = 0;
  const handler = fixOnly ? fixTopic : processTopic;
  const worker = async () => { while (idx < targets.length) { const t = targets[idx++]; try { results.push(await handler(t, recs)); } catch (e) { log(`[${t.slug}] 실패: ${e.message}`); results.push({ slug: t.slug, error: e.message }); } } };
  await Promise.all(Array.from({ length: concurrency }, worker));

  if (!dry) log(`묶음 갱신: posts.json / index.json — ${rebuildBundles()}편`);
  console.log("RESULT " + JSON.stringify(results));
})().catch((e) => { console.error("FATAL " + (e.stack || e)); process.exit(1); });
