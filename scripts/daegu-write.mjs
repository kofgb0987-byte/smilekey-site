#!/usr/bin/env node
// scripts/daegu-write.mjs — 대구 소식 작성기 (집 서버, Claude Code 구독 인증)
//
//   node scripts/daegu-write.mjs [--model opus] [--dry] [--no-think]
//
// 흐름:  Vercel daegu-candidates(후보) → claude -p(작성) → claude -p(팩트체크)
//        → Vercel daegu-save(검증·저장)   … 차단되면 같은 수집분으로 최대 3회 재시도
//
// 검증(중복·근거·종료행사)과 저장은 전부 서버가 한다. 이 스크립트는 모델 호출만 담당.
// 인증: 로컬 `claude` CLI 로그인(구독). ANTHROPIC_API_KEY 불필요.
// 시크릿: infra/wsl/smilekey/cron.env 의 CRON_SECRET (또는 환경변수 CRON_SECRET)

import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildWritePrompt,
  buildReviewPrompt,
  extractJson,
  normalizeDraft,
} from "../lib/daegu-prompts.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const BASE_URL = process.env.SMILEKEY_BASE_URL || "https://smilekey.me";
const MAX_ATTEMPTS = 3;
const CLI_TIMEOUT_MS = 240000;

// ---------- 인자 ----------
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : dflt;
};
const model = String(opt("model", "opus"));
const dry = flag("dry");
const noThink = flag("no-think");
const AI_MODEL_TAG = `claude-${model}(sub)`;

// ---------- 시크릿 ----------
function loadCronSecret() {
  if (process.env.CRON_SECRET) return process.env.CRON_SECRET.trim();
  const envFile = path.resolve(ROOT, "..", "infra", "wsl", "smilekey", "cron.env");
  if (!existsSync(envFile)) throw new Error(`CRON_SECRET 없음 (env 또는 ${envFile})`);
  const text = readFileSync(envFile, "utf8").replace(/^﻿/, "");
  const m = text.match(/^\s*CRON_SECRET\s*=\s*(.+?)\s*$/m);
  if (!m) throw new Error("cron.env에 CRON_SECRET 없음");
  return m[1].replace(/^["']|["']$/g, "");
}
const SECRET = loadCronSecret();

// ---------- HTTP ----------
async function api(pathname, { method = "POST", body, timeoutMs = 130000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${BASE_URL}${pathname}`, {
      method,
      headers: {
        Authorization: `Bearer ${SECRET}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await r.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`${pathname} ${r.status} 비JSON 응답: ${text.slice(0, 200)}`);
    }
    if (!r.ok) throw new Error(`${pathname} ${r.status}: ${json.error || text.slice(0, 200)}`);
    return json;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- claude -p ----------
// Mitra 번역기(kr-migrant-portal/scripts/translate.mjs)에서 검증된 호출 형태 그대로.
// --tools "" 로 도구를 끄고, 세션을 남기지 않는다. 표준입력으로 프롬프트를 넘긴다.
function runClaude(prompt) {
  const cmd = process.platform === "win32" ? "claude.cmd" : "claude";
  const args = ["-p", "--model", model, "--output-format", "text", "--tools", '""', "--no-session-persistence"];
  const env = { ...process.env };
  if (noThink) env.MAX_THINKING_TOKENS = "0";
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: ROOT, env, shell: true, stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`claude 타임아웃(${CLI_TIMEOUT_MS / 1000}s)`));
    }, CLI_TIMEOUT_MS);
    child.stdout.on("data", (d) => (out += d.toString("utf8")));
    child.stderr.on("data", (d) => (err += d.toString("utf8")));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0 && !out.trim()) return reject(new Error(`claude exited ${code}: ${err.slice(0, 500)}`));
      resolve(out);
    });
    child.stdin.end(prompt, "utf8");
  });
}

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---------- 본체 ----------
async function main() {
  const t0 = Date.now();
  log(`daegu-write 시작 model=${model} dry=${dry} base=${BASE_URL}`);

  const attempts = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // 1) 후보 — 매 회차 새로 수집(4초). 직전 시도에서 소진된 링크는 서버가 빼서 준다.
    const cand = await api("/api/cron/daegu-candidates");
    if (cand.empty) {
      log(`종료: ${cand.reason}`);
      return { ok: true, skipped: cand.reason, attempts };
    }
    const batch = cand.batch;
    log(
      `후보 attempt=${attempt} fresh=${cand.fresh}/${cand.totalCandidates} ` +
        `mix=${JSON.stringify(cand.sourceMix)} freshMix=${JSON.stringify(cand.freshMix)} ` +
        `timings=${JSON.stringify(cand.timings)}`
    );

    // 2) 작성
    const writePrompt = buildWritePrompt({
      candidates: cand.candidates,
      today: cand.today,
      recentTitles: cand.recentTitles,
    });
    let raw;
    try {
      raw = await runClaude(writePrompt);
    } catch (e) {
      attempts.push(`AI 작성 실패: ${e.message}`);
      log(`작성 실패: ${e.message}`);
      continue;
    }
    const draft = normalizeDraft(extractJson(raw));
    if (draft.error) {
      attempts.push(`AI 작성 실패: ${draft.error}`);
      log(`작성 파싱 실패: ${draft.error} — 앞부분: ${raw.slice(0, 200).replace(/\s+/g, " ")}`);
      continue;
    }
    if (draft.skip) {
      log(`작성 스킵: ${draft.reason}`);
      return { ok: true, skipped: `작성 스킵: ${draft.reason}`, attempts };
    }
    log(`초안: "${draft.title}" 근거 ${draft.used_links.length}건 섹션 ${draft.sections.length}`);

    // 3) 팩트체크 — 판정 자체는 서버(judgeReview)가 한다. 여기선 모델 원본만 확보.
    let reviewRaw = null;
    try {
      const reviewPrompt = buildReviewPrompt({
        post: draft,
        candidates: cand.candidates,
        today: cand.today,
      });
      reviewRaw = extractJson(await runClaude(reviewPrompt));
      log(`검수 원본: ${JSON.stringify(reviewRaw).slice(0, 200)}`);
    } catch (e) {
      // 검수 불가 시 통과(기존 동작과 동일) — 작성 자체는 이미 성공한 상태
      log(`검수 호출 실패(통과 처리): ${e.message}`);
    }

    if (dry) {
      console.log("\n===== DRY RUN (저장 안 함) =====");
      console.log(JSON.stringify({ draft, reviewRaw }, null, 2));
      return { ok: true, dry: true, title: draft.title, attempts };
    }

    // 4) 검증·저장 — 차단되면 서버가 소재를 소진했으므로 같은 수집분으로 재시도
    const saved = await api("/api/cron/daegu-save", {
      body: { batch, draft, reviewRaw, aiModel: AI_MODEL_TAG },
    });
    if (saved.published) {
      log(`발행 완료: ${saved.title} id=${saved.id} isNew=${saved.isNew} ${Date.now() - t0}ms`);
      return { ok: true, id: saved.id, title: saved.title, isNew: saved.isNew, attempts };
    }
    if (saved.skipped) {
      log(`서버 스킵: ${saved.reason}`);
      return { ok: true, skipped: saved.reason, attempts };
    }
    attempts.push(saved.reason || "차단(이유 없음)");
    log(`차단: ${saved.reason}`);
  }

  log(`${MAX_ATTEMPTS}회 시도 모두 차단 ${Date.now() - t0}ms`);
  return { ok: true, skipped: `${MAX_ATTEMPTS}회 시도 모두 차단`, attempts };
}

main()
  .then((r) => {
    console.log("RESULT " + JSON.stringify(r));
    process.exit(0);
  })
  .catch((e) => {
    console.error("FATAL " + (e && e.stack ? e.stack : e));
    process.exit(1);
  });
