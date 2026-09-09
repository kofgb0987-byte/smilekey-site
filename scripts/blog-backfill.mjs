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
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
// 수집기(fetchBlogInnerHtml)가 iframe으로 들어가는 PC 본문 페이지 — 구 에디터 글도 postViewArea 컨테이너를 준다
const postViewUrl = (logNo) => `https://blog.naver.com/PostView.naver?blogId=${BLOG}&logNo=${logNo}&redirect=Dlog&widgetTypeCall=true&directAccess=false`;
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
const cleanText = (s = "") => String(s).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
function makeBlogSummary({ title, bodyText }) {
  const t = cleanText(title);
  const core = (bodyText || t).slice(0, 120);
  return `대구 동구 중앙열쇠 작업: ${t}. ${core} (자동차키·스마트키·도어락 문의 가능)`.replace(/\s+/g, " ").slice(0, 220);
}

const BAD_TEXT = [/날씨/i, /흐림|맑음|미세먼지/, /좋은\s*하루|행복한\s*하루/, /안녕하세요|반갑습니다|감사합니다/, /구독|좋아요|댓글/, /copyright|all rights reserved/i, /네이버 톡톡|이웃추가|본문 기타 기능|MY메뉴|본문 바로가기/];
const stripCode = (html) => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
function htmlToSentences(html, maxChars) {
  const text = html
    .replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;|&#034;/g, "\"")
    .replace(/&#65279;|﻿|​/g, " ")
    .replace(/<\/?(p|div|br|li|h[1-6]|section|article|span)[^>]*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const sentences = text.split(/(?<=[.!?。]|다[.!]?)\s+/).map((s) => s.trim()).filter((s) => s.length > 10 && !BAD_TEXT.some((re) => re.test(s)));
  return sentences.join(" ").slice(0, maxChars);
}
// 본문 컨테이너만: 스마트에디터(se-main-container) → 구 에디터(postViewArea) → post-view{logNo}. 끝은 하단 버튼/푸터/태그.
// script는 자르기 전에 제거 — 동영상 모듈의 data-module JSON이 컨테이너 안에 있어 끝 마커를 오인하게 만든다.
function container(html) {
  const h = stripCode(html);
  const ENDS = [/class="post-btn/, /id="post_footer_contents"/, /class="post_footer/, /class="wrap_tag/, /id="commentList/, /class="blog2_post_ad/];
  for (const startRe of [/<div[^>]+class="se-main-container"/, /<div[^>]+id="postViewArea"/, /<div[^>]+id="post-view\d+"/]) {
    const m = h.match(startRe); if (!m) continue;
    let end = h.length;
    for (const er of ENDS) { const mm = h.slice(m.index + 50).match(er); if (mm) end = Math.min(end, m.index + 50 + mm.index); }
    // 끝 마커는 태그 속성 위치라 그대로 자르면 "<div " 조각이 남는다 — 태그 시작(<) 전까지로 물린다
    const lt = h.lastIndexOf("<", end);
    if (lt > m.index) end = lt;
    return h.slice(m.index, end);
  }
  return "";
}
function extractBody(html, title) {
  let text = htmlToSentences(container(html), 1400);
  // 일부 글은 컨테이너 앞에 "카테고리 제목 대구 중앙열쇠 ・ 2018." 머리말이 붙는다 — 제목 위치까지 잘라낸다
  const t = cleanText(title);
  const ti = t ? text.indexOf(t) : -1;
  if (ti >= 0 && ti < 200) text = text.slice(ti + t.length).trim();
  text = text.replace(/^(?:.{0,40}?중앙열쇠\s*[・·]?\s*)?\d{4}\.\s+/, "").trim();
  return text.slice(0, 1200);
}
function extractImages(html, max = 5) {
  const out = [];
  for (const tag of container(html).match(/<img[^>]*>/gi) || []) {
    // data-lazy-src가 원본(type=w1), src는 흐림 썸네일(w80_blur)
    const pick = tag.match(/data-lazy-src="(https?:[^"]+)"/i) || tag.match(/\ssrc="(https?:[^"]+)"/i);
    if (!pick) continue;
    const u = pick[1];
    if (!/pstatic\.net|blogfiles|postfiles/.test(u)) continue;
    if (/static\.map|profile|sticker|blogpfthumb|\/static\/|editor-static|\.gif(\?|$)|type=w80_blur/i.test(u)) continue;
    if (/_\d{13}/.test(u) && !u.includes(`/${BLOG}_`)) continue; // 다른 블로거 위젯/배너 이미지
    if (!out.includes(u)) out.push(u);
    if (out.length >= max) break;
  }
  return out;
}
const isoDate = (s) => { const m = String(s).match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/); return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : ""; };

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
