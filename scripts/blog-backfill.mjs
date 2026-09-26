#!/usr/bin/env node
// scripts/blog-backfill.mjs — 옛 네이버 블로그 글을 작업 아카이브에 백필 (SRH로 프로덕션 Redis 직접 기록)
//
//   node scripts/blog-backfill.mjs --ids <tsv> [--tag <문자열>] [--write]
//     tsv: logNo<TAB>addDate("2020. 12. 15.")<TAB>title  (infra/tmp/yym_titles*.tsv 형식)
//     --write 없으면 미리보기만: 본문 추출 결과를 infra/tmp/backfill_preview.json 에 저장
//
// 왜 SRH 직접인가: 수집기(sync-summaries)는 RSS 최신 50편만 읽어 옛 글이 들어온 적이 없고,
//   saveSummary는 LPUSH라 옛 글이 /archive 첫 화면 맨 위로 올라온다 → 여기서는 RPUSH(목록 꼬리)로 넣는다.
//   id는 수집기와 동일(sha1 "blog:"+link)이라 RSS 경로와 중복되지 않는다.
// 요약(summary_ko)은 AI 대신 본문 발췌로 채운다 — 가이드 생성기가 title+summary_ko를 근거로 읽는다.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// 본문 추출 함수는 scripts/lib/naver-blog.mjs 로 옮겨 worklog-crawl.mjs 와 공유한다(2026-09-26)
import { UA, cleanText, extractBody, extractImages as extractImagesFor, isoDate, postViewUrl as postViewUrlFor } from "./lib/naver-blog.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SRH = process.env.SRH_URL || "http://localhost:8078";
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d; };
const WRITE = argv.includes("--write");
const BLOG = opt("blog", "yym0072");
const TAG = opt("tag", `blog-backfill-${new Date().toISOString().slice(0, 10)}`);
const IDS = opt("ids", "");
if (!IDS) { console.error("--ids <tsv> 필요"); process.exit(1); }
const PREVIEW = path.resolve(ROOT, "..", "infra", "tmp", "backfill_preview.json");
// 수집기(fetchBlogInnerHtml)가 iframe으로 들어가는 PC 본문 페이지 — 구 에디터 글도 postViewArea 컨테이너를 준다
const postViewUrl = (logNo) => postViewUrlFor(BLOG, logNo);
const extractImages = (html, max = 5) => extractImagesFor(html, BLOG, max);
const log = (...a) => console.error(new Date().toISOString().slice(11, 19), ...a);

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

const toProxyUrl = (u = "") => (u ? `/api/image-proxy?url=${encodeURIComponent(u)}` : "");
function makeBlogSummary({ title, bodyText }) {
  const t = cleanText(title);
  const core = (bodyText || t).slice(0, 120);
  return `대구 동구 중앙열쇠 작업: ${t}. ${core} (자동차키·스마트키·도어락 문의 가능)`.replace(/\s+/g, " ").slice(0, 220);
}

const rows = fs.readFileSync(IDS, "utf8").trim().split(/\r?\n/).map((l) => l.split("\t")).filter((r) => r.length >= 3 && /^\d+$/.test(r[0]));
log(`대상 ${rows.length}건 (${WRITE ? "기록" : "미리보기"}) tag=${TAG}`);
const items = [];
for (const [logNo, addDate, ...rest] of rows) {
  const title = rest.join("\t").replace(/\s+/g, " ").trim();
  const link = `https://blog.naver.com/${BLOG}/${logNo}`;
  const id = crypto.createHash("sha1").update(`blog:${link}`).digest("hex");
  let html = "";
  try { html = await (await fetch(postViewUrl(logNo), { headers: { "User-Agent": UA, Referer: "https://blog.naver.com/" } })).text(); }
  catch (e) { log(`[${logNo}] fetch 실패 ${e.message}`); }
  const bodyText = html ? extractBody(html, title) : "";
  const rawImgs = html ? extractImages(html) : [];
  const images = rawImgs.map(toProxyUrl);
  const summary_base = makeBlogSummary({ title, bodyText });
  const excerpt = bodyText ? bodyText.slice(0, 360).replace(/\s+\S*$/, "") : "";
  const summary_ko = excerpt ? `${cleanText(title).slice(0, 60)} — ${excerpt}` : summary_base;
  items.push({ id, logNo, source: "blog", title, link, date: isoDate(addDate), thumbnail: images[0] || "", images, bodyText, summary: summary_ko, summary_base, summary_ko, ai_model: "backfill:body-excerpt", backfill_tag: TAG });
  console.log(`${isoDate(addDate)}  ${logNo}  본문${String(bodyText.length).padStart(4)}자  img${rawImgs.length}  ${title.slice(0, 44)}`);
  await new Promise((r) => setTimeout(r, 300));
}
fs.mkdirSync(path.dirname(PREVIEW), { recursive: true });
fs.writeFileSync(PREVIEW, JSON.stringify(items, null, 1));
log(`미리보기 저장 ${PREVIEW}`);
const empty = items.filter((x) => !x.bodyText);
if (empty.length) log(`본문 0자 ${empty.length}건: ${empty.map((x) => x.logNo).join(",")}`);

if (!WRITE) { log("--write 없음 → 종료"); process.exit(0); }

const tok = srhToken();
const exists = await srh("/pipeline", items.map((x) => ["SISMEMBER", "smilekey:summary_ids:v1", x.id]), tok);
let added = 0, skipped = 0;
for (let i = 0; i < items.length; i++) {
  const x = items[i];
  if (exists[i]?.result === 1) { skipped++; continue; }
  const flat = [];
  for (const [k, v] of Object.entries({ source: x.source, title: x.title, link: x.link, date: x.date, thumbnail: x.thumbnail, images: JSON.stringify(x.images), bodyText: x.bodyText, summary: x.summary, summary_base: x.summary_base, summary_ko: x.summary_ko, ai_model: x.ai_model, backfill_tag: x.backfill_tag })) flat.push(k, String(v ?? ""));
  const res = await srh("/pipeline", [["HSET", `smilekey:summary:${x.id}`, ...flat], ["SADD", "smilekey:summary_ids:v1", x.id], ["RPUSH", "smilekey:summaries:v1", x.id]], tok);
  if (res.some((r) => r.error)) { log(`[${x.logNo}] 기록 오류`, JSON.stringify(res).slice(0, 200)); continue; }
  added++;
}
log(`완료: 추가 ${added} · 이미 있음 ${skipped}`);
const [scard, llen] = await srh("/pipeline", [["SCARD", "smilekey:summary_ids:v1"], ["LLEN", "smilekey:summaries:v1"]], tok);
log(`아카이브 set=${scard?.result} list=${llen?.result}`);
