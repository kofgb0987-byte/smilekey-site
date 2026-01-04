// pages/api/cron/sync-summaries.js
import crypto from "crypto";
import { XMLParser } from "fast-xml-parser";
import { saveSummary } from "../../../lib/redis";
import { aiSummarize3 } from "../../../lib/ai";



async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.7",
      "Referer": "https://blog.naver.com/",
    },
  });
  if (!res.ok) throw new Error(`fetchHtml failed ${res.status} ${url}`);
  return await res.text();
}
function normalizeNaverImg(u = "") {
  // blur 미리보기면 큰 사이즈로 교체
  return u.replace(/type=w80_blur/g, "type=w966");
}
function absolutizeUrl(base, rel) {
  try { return new URL(rel, base).toString(); }
  catch { return rel; }
}

async function extractBlogImagesFromPost(link, max = 5) {
  const html1 = await fetchHtml(link);

  const m = html1.match(/<iframe[^>]+id=["']mainFrame["'][^>]+src=["']([^"']+)["']/i);
  let html = html1;

  if (m && m[1]) {
    const frameUrl = absolutizeUrl(link, m[1]);
    html = await fetchHtml(frameUrl);
  }

  const raw = extractImagesFromHtml(html);
    const scriptHits =
  html.match(/https?:\/\/[^"'\\\s]+pstatic\.net[^"'\\\s]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'\\\s]+)?/gi) || [];
raw.push(...scriptHits);
  // ✅ merged 정의 (중복 제거)
  const merged = [...new Set([...raw, ...scriptHits])];

  const filtered = merged.filter((u) =>
    /blogfiles\.pstatic\.net/i.test(u) || /postfiles\.pstatic\.net/i.test(u)
  );

  return filtered.slice(0, max);
}



function extractImagesFromHtml(html = "") {
  const urls = [];
  const imgTags = html.match(/<img\b[^>]*>/gi) || [];

  for (const tag of imgTags) {
    const m = tag.match(/\s(?:src|data-src|data-lazy-src|data-original)\s*=\s*["']([^"']+)["']/i);
    if (!m) continue;

    let u = (m[1] || "").trim();
    if (!u) continue;

    u = u.replace(/&amp;/g, "&");
    if (u.startsWith("//")) u = "https:" + u;
    if (u.startsWith("http://")) u = u.replace("http://", "https://");

    if (!u.startsWith("http")) continue;
    if (u.startsWith("data:")) continue;
    if (/\/static\/blog\/profile\/img_profile_preset_/i.test(u)) continue;
    if (/\.gif(\?|$)/i.test(u)) continue;
    if (/spacer|blank|sprite|sticker/i.test(u)) continue;

    urls.push(u);
  }

  return [...new Set(urls)];
}


function toProxyUrl(u = "") {
  if (!u) return "";
  return `/api/image-proxy?url=${encodeURIComponent(u)}`;
}

function cleanText(s = "") {
  return String(s)
    .replace(/<[^>]*>/g, " ")       // 혹시 남은 태그 제거
    .replace(/\s+/g, " ")
    .trim();
}

function stripFluff(s = "") {
  const t = cleanText(s);

  const sentences = t
    .split(/(?<=[.!?。]|다\.)\s+/)
    .map((x) => x.trim())
    .filter(Boolean);

  const bad = [
    /날씨/i,
    /흐림|맑음|비|눈|미세먼지|기온/,
    /좋은\s*하루|행복한\s*하루|즐거운\s*하루/,
    /오늘도|내일도/,
    /웃는\s*얼굴|여유롭게|힘내/,
    /걱정하지\s*마세요|당황|막막/,
    /안녕하세요|반갑습니다|감사합니다/,
  ];

  const filtered = sentences.filter((line) => !bad.some((re) => re.test(line)));

  return filtered.join(" ").replace(/\s+/g, " ").trim();
}

function makeBlogSummary({ title, excerpt }) {
  const t = cleanText(title);
  const e = stripFluff(excerpt);

  // 핵심만 1~2문장으로 줄이기
  const core = (e && e.length >= 25 ? e : t).slice(0, 120);

  return `대구 동구 중앙열쇠 작업: ${t}. ${core} (자동차키·스마트키·도어락 문의 가능)`
    .replace(/\s+/g, " ")
    .slice(0, 220);
}


function makeYoutubeSummary({ title }) {
  const t = cleanText(title);
  return `대구 동구 중앙열쇠 유튜브 작업 영상: ${t}. 자동차키·스마트키·도어락 관련 작업/문의 가능합니다.`
    .replace(/\s+/g, " ")
    .slice(0, 200);
}


export default async function handler(req, res) {
  // ✅ Vercel Cron 보안: Authorization: Bearer {CRON_SECRET}
  const auth = req.headers.authorization || "";
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const parser = new XMLParser({ ignoreAttributes: false });

  const youtubeFeedUrl =
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCRSiC2NpJQcvbHX6OdHV4VQ";
  const blogFeedUrl = "https://blog.rss.naver.com/yym0072.xml";

  let saved = 0;

  try {
    // ---- 유튜브 RSS ----
    const ytRes = await fetch(youtubeFeedUrl);
    const ytXml = await ytRes.text();
    const ytData = parser.parse(ytXml);

    const entries = ytData.feed?.entry
      ? Array.isArray(ytData.feed.entry)
        ? ytData.feed.entry
        : [ytData.feed.entry]
      : [];

    const youtubeItems = entries.slice(0, 3).map((entry) => {
      const title = entry.title || "";
      const link =
        (Array.isArray(entry.link)
          ? entry.link[0]["@_href"]
          : entry.link?.["@_href"]) || "";
      const published = entry.published || "";
      const thumb = entry["media:group"]?.["media:thumbnail"]?.["@_url"] || "";

      return {
        id: crypto.createHash("sha1").update(`yt:${link}`).digest("hex"),
        source: "youtube",
        title,
        link,
        date: published?.slice(0, 10) || "",
        thumbnail: thumb,
        summary: makeYoutubeSummary({ title }),
      };
    });

    for (const item of youtubeItems) {
  const isNew = await saveSummary({
    ...item,
    summary_base: item.summary, // base 백업
  });

  if (!isNew) continue;

  const tri = await aiSummarize3({
    title: item.title,
    baseSummary: item.summary,  // 규칙 요약을 초안으로
    source: "youtube",
    date: item.date,
  });

  if (tri?.ko) {
    await saveSummary({
      id: item.id,
      summary: tri.ko,          // ✅ 기본 노출 한국어
      summary_ko: tri.ko,
      summary_en: tri.en || "",
      summary_zh: tri.zh || "",
      ai_model: "gpt-5-mini",
      ai_at: new Date().toISOString(),
    });
  }
  saved++;
}


    // ---- 네이버 블로그 RSS ----
    const blogRes = await fetch(blogFeedUrl);
    const blogXml = await blogRes.text();
    const blogData = parser.parse(blogXml);

    const items = blogData.rss?.channel?.item
      ? Array.isArray(blogData.rss.channel.item)
        ? blogData.rss.channel.item
        : [blogData.rss.channel.item]
      : [];

    const blogItems = await Promise.all(items.slice(0, 3).map(async (item) => {
  const title = item.title || "";
  const link = item.link || "";
  const pubDate = item.pubDate || "";
  const description = item.description || "";

  // ✅ 1) 본문 이미지 3~5장 추출 (RSS description 말고 진짜 글 페이지)
  const rawImgs = (await extractBlogImagesFromPost(link, 5)).map(normalizeNaverImg);

  // ✅ 2) 프록시로 저장
  const proxiedImgs = rawImgs.map(toProxyUrl);

  // 대표 썸네일
  const thumb = proxiedImgs[0] || "";

  // excerpt는 일단 RSS description에서 뽑아도 OK (나중에 본문에서 뽑아도 됨)
  const text = description.replace(/<[^>]*>?/gm, "").trim();
  const excerpt = text.length > 120 ? text.slice(0, 120).trim() + "…" : text;

  const baseSummary = makeBlogSummary({ title, excerpt });

  return {
    id: crypto.createHash("sha1").update(`blog:${link}`).digest("hex"),
    source: "blog",
    title,
    link,
    date: pubDate?.slice(0, 16) || "",
    thumbnail: thumb,
    images: proxiedImgs, // ✅ 여기!
    excerpt,
    summary: baseSummary,
    summary_base: baseSummary,
  };
}));


    for (const item of blogItems) {
  const isNew = await saveSummary(item);
  if (!isNew) continue;

  const tri = await aiSummarize3({
    title: item.title,
    baseSummary: item.summary, // 규칙 요약 초안
    source: "blog",
    date: item.date,
  });
  if (tri?.ko) {
    await saveSummary({
      id: item.id,
      summary: tri.ko,
      summary_ko: tri.ko,
      summary_en: tri.en || "",
      summary_zh: tri.zh || "",
      ai_model: "gpt-5-mini",
      ai_at: new Date().toISOString(),
    });
  }

  saved++;
}


    return res.status(200).json({ ok: true, saved });
  } catch (e) {
    console.error("cron sync error:", e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
