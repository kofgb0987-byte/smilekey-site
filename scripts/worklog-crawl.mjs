#!/usr/bin/env node
// scripts/worklog-crawl.mjs — 네이버 블로그(yym0072) 전체 글을 긁어 작업일지 원자료를 만든다
//   node scripts/worklog-crawl.mjs --list                          1단계: 전체 목록 → DATA/posts.jsonl (약 5,900편, 1~2분)
//   node scripts/worklog-crawl.mjs --bodies [--concurrency 3] [--limit N]
//                                                                 2단계: 본문 → DATA/bodies/<logNo>.json (있는 건 건너뜀, 재실행 안전)
//   node scripts/worklog-crawl.mjs --status                        진행 현황
//   DATA = ../infra/tmp/smilekey-worklog (레포 밖 원자료 캐시). 구조화·집계는 worklog-extract.mjs 가 한다.
//   왜 따로 긁나: 사이트 수집기(sync-summaries)는 RSS 최신 50편만 읽고, 아카이브에 있는 397편은 전체 5,890편의 7%뿐이다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listUrl, parseList, parseAddDate, postViewUrl, fetchText, extractBody, extractImages } from "./lib/naver-blog.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d; };
const BLOG = opt("blog", "yym0072");
const DATA = path.resolve(opt("data", path.join(ROOT, "..", "infra", "tmp", "smilekey-worklog")));
const POSTS = path.join(DATA, "posts.jsonl");
const BODIES = path.join(DATA, "bodies");
const PAGE = 30; // 목록 API가 한 페이지에 주는 최대치
const log = (...a) => console.error(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(BODIES, { recursive: true });

const readPosts = () => fs.existsSync(POSTS) ? fs.readFileSync(POSTS, "utf8").trim().split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)) : [];

async function listAll() {
  const seen = new Map();
  let total = 0, page = 1, empty = 0;
  for (;;) {
    const { text, status } = await fetchText(listUrl(BLOG, page, PAGE), BLOG);
    if (!text) { log(`목록 ${page}페이지 HTTP ${status}`); break; }
    const { total: t, posts } = parseList(text);
    total = t;
    if (!posts.length) { if (++empty >= 2) break; await sleep(1000); continue; }
    empty = 0;
    for (const p of posts) if (!seen.has(p.logNo)) seen.set(p.logNo, { ...p, date: parseAddDate(p.addDate) });
    if (page % 20 === 0 || seen.size >= total) log(`목록 ${page}페이지 · ${seen.size}/${total}`);
    if (seen.size >= total) break;
    page++;
    await sleep(250);
  }
  const rows = [...seen.values()];
  fs.writeFileSync(POSTS, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const cats = {};
  for (const r of rows) cats[r.categoryNo] = (cats[r.categoryNo] || 0) + 1;
  const years = {};
  for (const r of rows) { const y = (r.date || "").slice(0, 4) || "?"; years[y] = (years[y] || 0) + 1; }
  log(`목록 저장 ${rows.length}편 (API totalCount ${total}) → ${POSTS}`);
  log("카테고리별:", JSON.stringify(cats));
  log("연도별:", Object.entries(years).sort().map(([y, n]) => `${y}:${n}`).join(" "));
}

async function fetchBodies() {
  const posts = readPosts();
  if (!posts.length) { log("posts.jsonl 없음 — --list 먼저"); process.exit(1); }
  const limit = parseInt(opt("limit", "0"), 10) || 0;
  const conc = Math.max(1, parseInt(opt("concurrency", "3"), 10) || 3);
  const todo = posts.filter((p) => !fs.existsSync(path.join(BODIES, p.logNo + ".json")));
  const queue = limit ? todo.slice(0, limit) : todo;
  log(`본문 대상 ${queue.length}편 (전체 ${posts.length}, 이미 있음 ${posts.length - todo.length}) · 동시 ${conc}`);
  let done = 0, fail = 0, emptyBody = 0;
  const t0 = Date.now();
  async function worker() {
    for (;;) {
      const p = queue.shift();
      if (!p) return;
      const out = path.join(BODIES, p.logNo + ".json");
      try {
        const { text: html, status } = await fetchText(postViewUrl(BLOG, p.logNo), BLOG);
        const bodyText = html ? extractBody(html, p.title, 1500) : "";
        const images = html ? extractImages(html, BLOG, 3) : [];
        if (!bodyText) emptyBody++;
        fs.writeFileSync(out, JSON.stringify({ logNo: p.logNo, title: p.title, date: p.date, categoryNo: p.categoryNo, status, bodyText, bodyLen: bodyText.length, images, fetchedAt: new Date().toISOString() }));
      } catch (e) {
        fail++;
        log(`[${p.logNo}] 실패 ${e.message}`);
      }
      done++;
      if (done % 100 === 0) {
        const rate = done / ((Date.now() - t0) / 1000);
        log(`본문 ${done}/${done + queue.length} · 실패 ${fail} · 본문0자 ${emptyBody} · 남은 시간 약 ${Math.round(queue.length / rate / 60)}분`);
      }
      await sleep(300);
    }
  }
  await Promise.all(Array.from({ length: conc }, worker));
  log(`본문 완료 ${done}편 · 실패 ${fail} · 본문0자 ${emptyBody} · ${Math.round((Date.now() - t0) / 1000)}초`);
}

function status() {
  const posts = readPosts();
  const have = fs.existsSync(BODIES) ? fs.readdirSync(BODIES).filter((f) => f.endsWith(".json")).length : 0;
  let empty = 0, blocked = 0;
  if (have) for (const f of fs.readdirSync(BODIES)) { try { const j = JSON.parse(fs.readFileSync(path.join(BODIES, f), "utf8")); if (!j.bodyText) empty++; if (j.status >= 400) blocked++; } catch {} }
  console.log(`목록 ${posts.length}편 · 본문 ${have}편 (본문0자 ${empty}, HTTP 4xx ${blocked}) · DATA=${DATA}`);
}

(async () => {
  if (flag("list")) await listAll();
  else if (flag("bodies")) await fetchBodies();
  else status();
})().catch((e) => { console.error("치명 오류:", e); process.exit(1); });
