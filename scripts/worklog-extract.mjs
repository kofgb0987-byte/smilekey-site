#!/usr/bin/env node
// scripts/worklog-extract.mjs — 블로그 원자료(worklog-crawl.mjs 산출)를 구독 Claude로 구조화해 작업일지를 만든다
//   node scripts/worklog-extract.mjs --extract [--model sonnet] [--batch 25] [--concurrency 3] [--limit N]
//        DATA/bodies/*.json → 25편씩 claude -p → DATA/extracted/<batchKey>.json (이미 뽑은 글은 건너뜀, 재실행 안전)
//   node scripts/worklog-extract.mjs --build
//        목록+본문+추출 결과를 합쳐 content/worklog/cases.jsonl · cases.csv · stats.json · README.md 생성
//   node scripts/worklog-extract.mjs --status
//   DATA = ../infra/tmp/smilekey-worklog. 비작업 카테고리(일상·여행·건조대·방충망·환풍기·공유글)는 추출하지 않고 stats에 제외 건수로만 남긴다.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { postLink } from "./lib/naver-blog.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d; };
const BLOG = opt("blog", "yym0072");
const DATA = path.resolve(opt("data", path.join(ROOT, "..", "infra", "tmp", "smilekey-worklog")));
const BODIES = path.join(DATA, "bodies");
const EXTRACTED = path.join(DATA, "extracted" + opt("suffix", "")); // --suffix -haiku 처럼 주면 별도 폴더(모델 비교용)
const OUT = path.join(ROOT, "content", "worklog");
const MODEL = opt("model", "sonnet");
const BATCH = Math.max(5, parseInt(opt("batch", "25"), 10) || 25);
const CONC = Math.max(1, parseInt(opt("concurrency", "3"), 10) || 3);
const LIMIT = parseInt(opt("limit", "0"), 10) || 0;
const BODY_CHARS = 380;
const CLAUDE_TIMEOUT_MS = 240_000;
const log = (...a) => console.error(new Date().toISOString().slice(11, 19), ...a);
fs.mkdirSync(EXTRACTED, { recursive: true });

// 블로그 카테고리 번호 → 이름(2026-09-26 제목 표본으로 판정). 비작업 카테고리는 추출 제외.
export const CATEGORY = {
  35: "차키(2015~)", 11: "차키(대표)", 25: "현대", 12: "수입차·기타", 26: "기아", 28: "쉐보레·대우", 29: "르노삼성", 41: "수입차·폴딩키", 27: "쌍용",
  42: "차키(2025)", 34: "오토바이", 33: "폴딩키", 14: "금고", 20: "도어락", 19: "현관·열쇠", 3: "일상", 31: "빨래건조대", 7: "공유·블로그", 5: "여행", 30: "방충망", 32: "환풍기", 22: "출입통제", 23: "인터폰",
};
const SKIP_CATEGORY = new Set(["3", "31", "7", "5", "30", "32", "22", "23"]);

const readPosts = () => fs.readFileSync(path.join(DATA, "posts.jsonl"), "utf8").trim().split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
function readBodies() {
  const out = new Map();
  if (!fs.existsSync(BODIES)) return out;
  for (const f of fs.readdirSync(BODIES)) if (f.endsWith(".json")) { try { const j = JSON.parse(fs.readFileSync(path.join(BODIES, f), "utf8")); out.set(j.logNo, j); } catch {} }
  return out;
}
function readExtracted() {
  const out = new Map();
  // 같은 글이 여러 파일에 있으면(재시도) 정상 행이 오류 행을 이긴다
  for (const f of fs.readdirSync(EXTRACTED)) if (f.endsWith(".json")) { try { for (const r of JSON.parse(fs.readFileSync(path.join(EXTRACTED, f), "utf8"))) { if (!r || !r.logNo) continue; const k = String(r.logNo); const prev = out.get(k); if (!prev || (prev.extract_error && !r.extract_error)) out.set(k, r); } } catch {} }
  return out;
}

// ---------- 모델 ----------
function claude(prompt) {
  return new Promise((resolve, reject) => {
    const args = ["-p", "--model", MODEL, "--output-format", "text", "--tools", '""', "--no-session-persistence"];
    // MAX_THINKING_TOKENS=0: 표 뽑기엔 사고 토큰이 시간만 잡아먹는다(아레나 시뮬레이터와 같은 설정)
    const child = spawn(process.platform === "win32" ? "claude.cmd" : "claude", args, { cwd: ROOT, shell: true, stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, MAX_THINKING_TOKENS: "0" } });
    let out = "", err = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error("claude 시간 초과")); }, CLAUDE_TIMEOUT_MS);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (c) => { clearTimeout(timer); c === 0 && out.trim() ? resolve(out.trim()) : reject(new Error(err.slice(-400) || "claude 실패")); });
    child.stdin.end(prompt, "utf8");
  });
}
// 출력은 JSON 대신 탭 구분 12열 — 필드명이 빠져 출력 토큰이 약 1/3 줄고(배치당 100초→약 1분), 행 단위라 한 줄이 깨져도 나머지는 산다
const COLS = ["logNo", "case", "domain", "brand", "model", "year", "imported", "key_type", "jobs", "outcome", "area", "notes"];
function parseTsv(raw) {
  const rows = [];
  for (const line of raw.replace(/```[a-z]*/gi, "").split(/\r?\n/)) {
    const cells = line.split("\t").map((c) => c.trim());
    if (cells.length !== COLS.length || !/^\d{6,}$/.test(cells[0])) continue; // 열 수가 안 맞는 줄은 버리고 재시도에 맡긴다
    const r = Object.fromEntries(COLS.map((c, i) => [c, cells[i]]));
    r.case = /^(true|예|y|1)$/i.test(r.case);
    r.imported = /^true$/i.test(r.imported) ? true : /^false$/i.test(r.imported) ? false : null;
    r.jobs = r.jobs.split("|").map((s) => s.trim()).filter((s) => s && s !== "-");
    for (const k of ["model", "year", "area", "notes"]) if (r[k] === "-") r[k] = "";
    rows.push(r);
  }
  if (!rows.length) throw new Error("TSV 행 없음: " + raw.slice(0, 120).replace(/\n/g, " "));
  return rows;
}

const BRANDS = "현대, 기아, 제네시스, 쉐보레(대우·GM 포함), 르노삼성(삼성·르노 포함), 쌍용(KGM 포함), 벤츠, BMW, 미니, 아우디, 폭스바겐, 볼보, 렉서스, 토요타, 혼다, 닛산, 인피니티, 푸조, 시트로엥, 지프, 크라이슬러, 닷지, 포드, 링컨, 캐딜락, 재규어, 랜드로버, 포르쉐, 마세라티, 테슬라, 야마하, 스즈키, 가와사키, 대림, KR모터스, 현대트럭, 타타대우, 만, 스카니아, 볼보트럭, 지게차, 기타, 불명";
function prompt(items) {
  return `너는 대구 열쇠집 "중앙열쇠"의 블로그 글을 읽고 작업일지 표를 만드는 정리 담당자다. 아래 [글 목록]의 글마다 한 줄씩, 탭(TAB)으로 구분한 12열을 출력한다. 머리글·설명·마크다운·코드펜스 금지. **값이 없으면 반드시 - 하나를 쓴다(빈칸 금지, 열 수는 항상 12).** 값 안에 탭·줄바꿈을 넣지 않는다.

열 순서와 규칙:
1. logNo: 글 번호 그대로
2. case: 특정 차량·현장에서 실제로 한 작업을 서술한 글이면 true — 과거형 작업 서술("~제작했습니다", "~해결했습니다", "이번 작업은", "오늘 ~에서", 작업 사진 설명, 작업 후 시동 확인 등)이 본문에 있어야 한다. "~가능합니다", "~해 드립니다", "~하는 경우가 많습니다"처럼 일반론·홍보·서비스 안내·키 종류 설명만 있으면 false. 제목이 "OO 분실 제작"이어도 본문에 실제 작업 서술이 없으면 false
3. domain: 차키 | 오토바이키 | 도어락 | 금고 | 기타 (지게차·중장비·트럭 키는 차키)
4. brand: 다음 목록 중 하나로 정규화 — ${BRANDS}
5. model: 글에 적힌 차종·모델명(세대 코드 포함, 예 "그랜저 HG", "아반떼 AD", "SM5 노브형", "골프 7세대"). 없으면 -
6. year: 연식이 적혀 있으면 2019 형식, 없으면 -
7. imported: 수입차·수입 오토바이면 true, 국산이면 false, 판단 불가·해당 없음이면 -
8. key_type: 스마트키 | 폴딩키 | 일반키 | 카드키 | 리모컨키 | 롱롱키 | 불명
9. jobs: 분실제작 | 복사 | 차문개방 | 트렁크개방 | 이그니션수리 | 리모컨수리 | 배터리교체 | 도어락설치 | 도어락교체 | 도어락수리 | 도어락개방 | 금고개방 | 기타 중 글이 실제로 다룬 것만, 여러 개면 |로 연결(예 분실제작|차문개방)
10. outcome: 완료 | 불가 | 안내만 | 불명 — 작업을 끝냈다고 쓰여 있으면 완료, 못 했다·서비스센터로 안내했다면 불가, 사례 없이 안내만이면 안내만
11. area: 작업 장소가 적혀 있으면 "대구 동구 방촌동"처럼 시·구·동 수준으로, 없으면 -. 출장 가능 지역 나열은 무시
12. notes: 봇이 알아야 할 제약·특이사항 한 문장(예 "원키 없으면 제작 불가, 서비스센터 안내", "딜러 코드 필요", "연식별 키 방식 다름 HD 폴딩·AD 스마트키"). 없으면 -

규칙: 글에 없는 내용은 만들지 않는다. 제목의 키워드 나열(예 "대구차키분실,대구자동차키")은 홍보 태그이므로 case 판정에 쓰지 않는다. 가격·전화번호는 적지 않는다.
본문이 비어 있거나 한두 문장뿐인 글(옛 글에 많다)도 반드시 한 줄을 출력한다 — 제목만으로 domain·brand·model·key_type·jobs를 채우고, 작업 서술이 없으면 case=false·outcome=불명, 모르는 값은 -. 본문이 없다는 이유로 출력을 거부하거나 설명을 쓰지 않는다.
출력 예시(두 줄):
224422878038\ttrue\t차키\t르노삼성\tQM3\t-\tfalse\t스마트키\t분실제작|차문개방\t완료\t대구 동구 신암동\t전량 분실, 현장 등록으로 해결
224421803420\tfalse\t차키\t벤츠\t-\t-\ttrue\t스마트키\t차문개방\t안내만\t-\t무리한 개방 시 도어 몰딩 손상 위험

[글 목록]
${items.map((p) => `### logNo=${p.logNo} | ${p.date} | ${p.title}\n${(p.bodyText || "").slice(0, BODY_CHARS)}`).join("\n\n")}`;
}

// 모델이 목록 표기를 그대로 베껴 "쉐보레(대우·GM 포함)"처럼 내놓는 경우가 있어 괄호 설명은 떼고 대표명만 남긴다
const cleanBrand = (b) => String(b || "").replace(/\s*[（(].*?[)）]\s*$/, "").trim() || "불명";
const ENUM = {
  domain: new Set(["차키", "오토바이키", "도어락", "금고", "기타"]),
  key_type: new Set(["스마트키", "폴딩키", "일반키", "카드키", "리모컨키", "롱롱키", "불명"]),
  outcome: new Set(["완료", "불가", "안내만", "불명"]),
};
function normalize(r) {
  const o = {
    logNo: String(r.logNo || ""),
    case: r.case === true,
    domain: ENUM.domain.has(r.domain) ? r.domain : "기타",
    brand: cleanBrand(r.brand),
    model: String(r.model || "").trim(),
    year: String(r.year || "").match(/\d{4}/)?.[0] || "",
    imported: r.imported === true ? true : r.imported === false ? false : null,
    key_type: ENUM.key_type.has(r.key_type) ? r.key_type : "불명",
    jobs: Array.isArray(r.jobs) ? r.jobs.map(String).filter(Boolean).slice(0, 6) : [],
    outcome: ENUM.outcome.has(r.outcome) ? r.outcome : "불명",
    area: String(r.area || "").trim(),
    notes: String(r.notes || "").trim().slice(0, 200),
  };
  return o;
}

async function extract() {
  const posts = readPosts();
  const bodies = readBodies();
  // 재실행 시 정상 추출된 글만 건너뛰고, extract_error 행(모델 실패)은 다시 시도한다
  const done = new Map([...readExtracted()].filter(([, r]) => !r.extract_error));
  let targets = posts.filter((p) => !SKIP_CATEGORY.has(p.categoryNo) && bodies.has(p.logNo) && !done.has(p.logNo)).map((p) => ({ ...p, bodyText: bodies.get(p.logNo).bodyText }));
  if (LIMIT) targets = targets.slice(0, LIMIT);
  const batches = [];
  for (let i = 0; i < targets.length; i += BATCH) batches.push(targets.slice(i, i + BATCH));
  log(`추출 대상 ${targets.length}편 → ${batches.length}배치(${BATCH}편) · 모델 ${MODEL} · 동시 ${CONC} · 이미 있음 ${done.size}`);
  if (flag("dry")) { console.log(prompt(batches[0] || [])); return; }
  let bi = 0, ok = 0, failed = 0, rows = 0;
  const t0 = Date.now();
  async function worker() {
    for (;;) {
      const idx = bi++;
      const batch = batches[idx];
      if (!batch) return;
      const want = new Set(batch.map((p) => p.logNo));
      let got = [];
      for (let attempt = 0; attempt < 2 && want.size; attempt++) {
        try {
          const raw = await claude(prompt(batch.filter((p) => want.has(p.logNo))));
          for (const r of parseTsv(raw)) { const n = normalize(r); if (want.has(n.logNo)) { got.push(n); want.delete(n.logNo); } }
        } catch (e) { log(`배치 ${idx + 1} 시도 ${attempt + 1} 실패: ${e.message}`); }
      }
      for (const logNo of want) got.push({ ...normalize({ logNo }), extract_error: true });
      fs.writeFileSync(path.join(EXTRACTED, `${batch[0].logNo}.json`), JSON.stringify(got));
      ok++; rows += got.length; failed += want.size;
      if (ok % 10 === 0 || ok === batches.length) {
        const per = (Date.now() - t0) / ok;
        log(`배치 ${ok}/${batches.length} · 행 ${rows} · 미추출 ${failed} · 남은 시간 약 ${Math.round((batches.length - ok) * per / CONC / 60000)}분`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  log(`추출 완료 · 배치 ${ok} · 행 ${rows} · 미추출 ${failed} · ${Math.round((Date.now() - t0) / 60000)}분`);
}

// ---------- 합치기 ----------
const csvCell = (v) => { const s = Array.isArray(v) ? v.join("|") : v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, "\"\"")}"` : s; };
function build() {
  const posts = readPosts();
  const bodies = readBodies();
  const ex = readExtracted();
  fs.mkdirSync(OUT, { recursive: true });
  const rows = [];
  const skipped = {};
  for (const p of posts.sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.logNo.localeCompare(a.logNo))) {
    if (SKIP_CATEGORY.has(p.categoryNo)) { const c = CATEGORY[p.categoryNo] || p.categoryNo; skipped[c] = (skipped[c] || 0) + 1; continue; }
    const e = ex.get(p.logNo);
    const b = bodies.get(p.logNo);
    rows.push({
      logNo: p.logNo, date: p.date, title: p.title, link: postLink(BLOG, p.logNo), category: CATEGORY[p.categoryNo] || p.categoryNo,
      case: e ? e.case : null, domain: e?.domain || "", brand: e ? cleanBrand(e.brand) : "", model: e?.model || "", year: e?.year || "", imported: e ? e.imported : null,
      key_type: e?.key_type || "", jobs: e?.jobs || [], outcome: e?.outcome || "", area: e?.area || "", notes: e?.notes || "",
      excerpt: (b?.bodyText || "").slice(0, 200), extracted: !!e && !e.extract_error,
    });
  }
  fs.writeFileSync(path.join(OUT, "cases.jsonl"), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const cols = ["logNo", "date", "title", "link", "category", "case", "domain", "brand", "model", "year", "imported", "key_type", "jobs", "outcome", "area", "notes"];
  fs.writeFileSync(path.join(OUT, "cases.csv"), "﻿" + cols.join(",") + "\n" + rows.map((r) => cols.map((c) => csvCell(r[c])).join(",")).join("\n") + "\n");

  // ---------- 집계 ----------
  const count = (arr, f) => { const m = {}; for (const r of arr) { const k = f(r); if (k === undefined || k === null || k === "") continue; m[k] = (m[k] || 0) + 1; } return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const cases = rows.filter((r) => r.case === true);
  const stats = {
    generated_at: new Date().toISOString(), blog: BLOG, posts_total: posts.length, posts_in_scope: rows.length, extracted: rows.filter((r) => r.extracted).length, cases: cases.length,
    skipped_categories: skipped,
    by_year: count(rows, (r) => r.date.slice(0, 4)).sort(), cases_by_year: count(cases, (r) => r.date.slice(0, 4)).sort(),
    by_domain: count(cases, (r) => r.domain), by_brand: count(cases, (r) => r.brand), by_job: count(cases.flatMap((r) => r.jobs.map((j) => ({ j }))), (r) => r.j),
    by_key_type: count(cases, (r) => r.key_type), by_outcome: count(cases, (r) => r.outcome),
    imported: { true: cases.filter((r) => r.imported === true).length, false: cases.filter((r) => r.imported === false).length, null: cases.filter((r) => r.imported === null).length },
    by_model_top: count(cases.filter((r) => r.model), (r) => `${r.brand} ${r.model}`).slice(0, 60),
    by_area: count(cases, (r) => r.area).slice(0, 40),
    constraints: rows.filter((r) => r.notes && /불가|안 됨|안됨|필요|어려|서비스센터|딜러|원키/.test(r.notes)).map((r) => ({ date: r.date, brand: r.brand, model: r.model, year: r.year, notes: r.notes, link: r.link })),
  };
  fs.writeFileSync(path.join(OUT, "stats.json"), JSON.stringify(stats, null, 1));

  const table = (pairs, h1, h2 = "건수", n = pairs.length) => `| ${h1} | ${h2} |\n|---|---:|\n` + pairs.slice(0, n).map(([k, v]) => `| ${k} | ${v} |`).join("\n");
  const md = `# 중앙열쇠 작업일지 (블로그 ${BLOG} 전체 수집)

생성 ${stats.generated_at.slice(0, 10)} · 블로그 글 ${stats.posts_total}편 중 작업 관련 ${stats.posts_in_scope}편(비작업 카테고리 제외) · 구조화 ${stats.extracted}편 · **실제 작업 사례 ${stats.cases}건**

- 원자료: 네이버 블로그 전체 목록·본문(\`scripts/worklog-crawl.mjs\`, 캐시는 레포 밖 infra/tmp/smilekey-worklog)
- 구조화: 구독 Claude(${MODEL})가 글마다 사례 여부·브랜드·모델·연식·키 방식·작업·결과·제약을 뽑음(\`scripts/worklog-extract.mjs\`)
- 파일: \`cases.jsonl\`(전체 필드) · \`cases.csv\`(엑셀용, BOM) · \`stats.json\`
- 제외 카테고리: ${Object.entries(skipped).map(([k, v]) => `${k} ${v}`).join(", ")}
- 주의: 블로그에 올린 작업만 있다. 글 하나가 작업 하나가 아닐 수 있고(홍보 글은 case=false), 연식·지역은 글에 적힌 경우에만 채워진다.

## 연도별 (작업 관련 글 / 실제 사례)
| 연도 | 글 | 사례 |
|---|---:|---:|
${stats.by_year.map(([y, n]) => `| ${y} | ${n} | ${(stats.cases_by_year.find((x) => x[0] === y) || [0, 0])[1]} |`).join("\n")}

## 분야
${table(stats.by_domain, "분야")}

## 브랜드 (사례 기준)
${table(stats.by_brand, "브랜드", "건수", 30)}

## 작업 종류
${table(stats.by_job, "작업")}

## 키 방식
${table(stats.by_key_type, "키 방식")}

## 결과
${table(stats.by_outcome, "결과")} · 수입차 ${stats.imported.true} / 국산 ${stats.imported.false} / 미상 ${stats.imported.null}

## 모델 상위
${table(stats.by_model_top, "브랜드 모델", "건수", 40)}

## 지역 (적힌 경우만)
${table(stats.by_area, "지역", "건수", 25)}

## 제약·특이사항이 적힌 글 (${stats.constraints.length}건, 상담봇 등록부 후보)
${stats.constraints.slice(0, 80).map((c) => `- ${c.date} ${c.brand} ${c.model}${c.year ? `(${c.year})` : ""}: ${c.notes} — [글](${c.link})`).join("\n")}
`;
  fs.writeFileSync(path.join(OUT, "README.md"), md);
  log(`작업일지 저장 → ${OUT} (글 ${rows.length} · 구조화 ${stats.extracted} · 사례 ${stats.cases})`);
}

function status() {
  const posts = readPosts();
  const bodies = readBodies();
  const ex = readExtracted();
  const scope = posts.filter((p) => !SKIP_CATEGORY.has(p.categoryNo));
  console.log(`목록 ${posts.length} · 대상(비작업 제외) ${scope.length} · 본문 ${bodies.size} · 추출 ${ex.size} (오류 ${[...ex.values()].filter((r) => r.extract_error).length})`);
}

(async () => {
  if (flag("extract")) await extract();
  else if (flag("build")) build();
  else status();
})().catch((e) => { console.error("치명 오류:", e); process.exit(1); });
