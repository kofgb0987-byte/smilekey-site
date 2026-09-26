// scripts/lib/naver-blog.mjs — 네이버 블로그 공용 함수 (목록 API 파싱 + PC PostView 본문 추출)
//   blog-backfill.mjs(아카이브 백필)와 worklog-crawl.mjs(작업일지 전체 수집)가 같이 쓴다.
//   목록: PostTitleListAsync.naver — JSON이지만 pagingHtml에 \' 비표준 이스케이프가 있어 그대로 JSON.parse 하면 깨진다.
//   본문: PostView.naver(iframe 안 PC 페이지). 스마트에디터(se-main-container) → 구 에디터(postViewArea) 순으로 컨테이너를 찾는다.

export const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
export const headers = (blog) => ({ "User-Agent": UA, Referer: `https://blog.naver.com/${blog}` });

export const postViewUrl = (blog, logNo) => `https://blog.naver.com/PostView.naver?blogId=${blog}&logNo=${logNo}&redirect=Dlog&widgetTypeCall=true&directAccess=false`;
export const listUrl = (blog, page, count = 30) => `https://blog.naver.com/PostTitleListAsync.naver?blogId=${blog}&currentPage=${page}&countPerPage=${count}&categoryNo=0&parentCategoryNo=0&viewdate=`;
export const postLink = (blog, logNo) => `https://blog.naver.com/${blog}/${logNo}`;

/** 목록 API 응답 → { total, posts[] }. title은 form 인코딩(+가 공백) */
export function parseList(text) {
  const j = JSON.parse(String(text).replace(/\\'/g, "'"));
  if (j.resultCode !== "S") throw new Error("목록 API 실패: " + (j.resultMessage || j.resultCode));
  const posts = (j.postList || []).map((p) => {
    let title = String(p.title || "");
    try { title = decodeURIComponent(title.replace(/\+/g, " ")); } catch { /* 깨진 인코딩은 원문 유지 */ }
    return {
      logNo: String(p.logNo),
      title: title.replace(/\s+/g, " ").trim(),
      addDate: String(p.addDate || ""),
      categoryNo: String(p.categoryNo || ""),
      parentCategoryNo: String(p.parentCategoryNo || ""),
      commentCount: parseInt(p.commentCount, 10) || 0,
    };
  });
  return { total: parseInt(j.totalCount, 10) || 0, posts };
}

/** "2026. 9. 25." → 2026-09-25 · "16시간 전"/"3분 전"/"방금 전"/"어제" → 오늘 기준 KST 날짜 */
export function parseAddDate(s, now = new Date()) {
  const m = String(s).match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  const kst = new Date(now.getTime() + 9 * 3600e3);
  const rel = String(s);
  let d = kst;
  const h = rel.match(/(\d+)\s*시간\s*전/); const mi = rel.match(/(\d+)\s*분\s*전/); const day = rel.match(/(\d+)\s*일\s*전/);
  if (h) d = new Date(kst.getTime() - parseInt(h[1], 10) * 3600e3);
  else if (day) d = new Date(kst.getTime() - parseInt(day[1], 10) * 86400e3);
  else if (/어제/.test(rel)) d = new Date(kst.getTime() - 86400e3);
  else if (!mi && !/방금|초 전/.test(rel)) return "";
  return d.toISOString().slice(0, 10);
}
export const isoDate = (s) => parseAddDate(s);

export const cleanText = (s = "") => String(s).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const BAD_TEXT = [/날씨/i, /흐림|맑음|미세먼지/, /좋은\s*하루|행복한\s*하루/, /안녕하세요|반갑습니다|감사합니다/, /구독|좋아요|댓글/, /copyright|all rights reserved/i, /네이버 톡톡|이웃추가|본문 기타 기능|MY메뉴|본문 바로가기/];
export const stripCode = (html) => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");

export function htmlToSentences(html, maxChars) {
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
export function container(html) {
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

export function extractBody(html, title, maxChars = 1200) {
  let text = htmlToSentences(container(html), Math.max(maxChars + 200, 1400));
  // 일부 글은 컨테이너 앞에 "카테고리 제목 대구 중앙열쇠 ・ 2018." 머리말이 붙는다 — 제목 위치까지 잘라낸다
  const t = cleanText(title);
  const ti = t ? text.indexOf(t) : -1;
  if (ti >= 0 && ti < 200) text = text.slice(ti + t.length).trim();
  text = text.replace(/^(?:.{0,40}?중앙열쇠\s*[・·]?\s*)?\d{4}\.\s+/, "").trim();
  return text.slice(0, maxChars);
}

export function extractImages(html, blog, max = 5) {
  const out = [];
  for (const tag of container(html).match(/<img[^>]*>/gi) || []) {
    // data-lazy-src가 원본(type=w1), src는 흐림 썸네일(w80_blur)
    const pick = tag.match(/data-lazy-src="(https?:[^"]+)"/i) || tag.match(/\ssrc="(https?:[^"]+)"/i);
    if (!pick) continue;
    const u = pick[1];
    if (!/pstatic\.net|blogfiles|postfiles/.test(u)) continue;
    if (/static\.map|profile|sticker|blogpfthumb|\/static\/|editor-static|\.gif(\?|$)|type=w80_blur/i.test(u)) continue;
    if (/_\d{13}/.test(u) && !u.includes(`/${blog}_`)) continue; // 다른 블로거 위젯/배너 이미지
    if (!out.includes(u)) out.push(u);
    if (out.length >= max) break;
  }
  return out;
}

/** fetch + 재시도(지수 백오프). 4xx는 재시도하지 않고 상태를 돌려준다 */
export async function fetchText(url, blog, { retries = 3, timeoutMs = 20000 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), timeoutMs);
      const r = await fetch(url, { headers: headers(blog), signal: ac.signal });
      clearTimeout(t);
      if (r.status >= 400 && r.status < 500) return { status: r.status, text: "" };
      if (!r.ok) throw new Error("HTTP " + r.status);
      return { status: r.status, text: await r.text() };
    } catch (e) {
      lastErr = e;
      await new Promise((res) => setTimeout(res, 800 * 2 ** i));
    }
  }
  throw lastErr;
}
