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

function absolutizeUrl(base, rel) {
  try { return new URL(rel, base).toString(); }
  catch { return rel; }
}

function normalizeNaverImg(u = "") {
  return u.replace(/type=w80_blur/g, "type=w966");
}

function toProxyUrl(u = "") {
  if (!u) return "";
  return `/api/image-proxy?url=${encodeURIComponent(u)}`;
}

// Naver 블로그 iframe 구조 처리 — 내부 HTML 한 번만 가져옴
async function fetchBlogInnerHtml(link) {
  const html1 = await fetchHtml(link);
  const m = html1.match(/<iframe[^>]+id=["']mainFrame["'][^>]+src=["']([^"']+)["']/i);
  if (m && m[1]) {
    const frameUrl = absolutizeUrl(link, m[1]);
    return await fetchHtml(frameUrl);
  }
  return html1;
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

function extractBlogImages(html, max = 5) {
  const raw = extractImagesFromHtml(html);
  const scriptHits =
    html.match(/https?:\/\/[^"'\\\s]+pstatic\.net[^"'\\\s]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'\\\s]+)?/gi) || [];
  const merged = [...new Set([...raw, ...scriptHits])];
  return merged
    .filter((u) => /blogfiles\.pstatic\.net/i.test(u) || /postfiles\.pstatic\.net/i.test(u))
    .map(normalizeNaverImg)
    .slice(0, max);
}

// 블로그 본문 텍스트 추출
function extractBlogText(html = "", maxChars = 1200) {
  const BAD_TEXT = [
    /날씨/i, /흐림|맑음|미세먼지/, /좋은\s*하루|행복한\s*하루/,
    /안녕하세요|반갑습니다|감사합니다/, /구독|좋아요|댓글/,
    /copyright|all rights reserved/i,
  ];

  const text = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/<\/?(p|div|br|li|h[1-6]|section|article)[^>]*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // 문장 단위로 쪼개서 노이즈 필터링
  const sentences = text
    .split(/(?<=[.!?。]|다[.!]?)\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10 && !BAD_TEXT.some((re) => re.test(s)));

  return sentences.join(" ").slice(0, maxChars);
}

function cleanText(s = "") {
  return String(s).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function makeBlogSummary({ title, bodyText }) {
  const t = cleanText(title);
  const core = (bodyText || t).slice(0, 120);
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
    // ---- 유튜브 ----
    const ytRes = await fetch(youtubeFeedUrl);
    const ytData = parser.parse(await ytRes.text());

    const entries = ytData.feed?.entry
      ? Array.isArray(ytData.feed.entry) ? ytData.feed.entry : [ytData.feed.entry]
      : [];

    const youtubeItems = entries.slice(0, 3).map((entry) => {
      const title = entry.title || "";
      const link =
        (Array.isArray(entry.link) ? entry.link[0]["@_href"] : entry.link?.["@_href"]) || "";
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
      const isNew = await saveSummary({ ...item, summary_base: item.summary });
      if (!isNew) continue;

      const tri = await aiSummarize3({
        title: item.title,
        baseSummary: item.summary,
        source: "youtube",
        date: item.date,
      });

      if (tri?.ko) {
        await saveSummary({
          id: item.id,
          summary: tri.ko,
          summary_ko: tri.ko,
          summary_en: tri.en || "",
          summary_zh: tri.zh || "",
          ai_model: "gpt-4o-mini",
          ai_at: new Date().toISOString(),
        });
      }
      saved++;
    }

    // ---- 네이버 블로그 ----
    const blogRes = await fetch(blogFeedUrl);
    const blogData = parser.parse(await blogRes.text());

    const rssItems = blogData.rss?.channel?.item
      ? Array.isArray(blogData.rss.channel.item) ? blogData.rss.channel.item : [blogData.rss.channel.item]
      : [];

    const blogItems = await Promise.all(
      rssItems.slice(0, 3).map(async (item) => {
        const title = item.title || "";
        const link = item.link || "";
        const pubDate = item.pubDate || "";

        // 블로그 HTML 한 번만 크롤링 → 이미지 + 본문 텍스트 모두 추출
        let rawImgs = [];
        let bodyText = "";
        try {
          const innerHtml = await fetchBlogInnerHtml(link);
          rawImgs = extractBlogImages(innerHtml, 5);
          bodyText = extractBlogText(innerHtml, 1200);
        } catch (e) {
          console.error("blog crawl error:", e);
        }

        const proxiedImgs = rawImgs.map(toProxyUrl);
        const thumb = proxiedImgs[0] || "";
        const baseSummary = makeBlogSummary({ title, bodyText });

        return {
          id: crypto.createHash("sha1").update(`blog:${link}`).digest("hex"),
          source: "blog",
          title,
          link,
          date: pubDate?.slice(0, 16) || "",
          thumbnail: thumb,
          images: proxiedImgs,
          bodyText,
          summary: baseSummary,
          summary_base: baseSummary,
        };
      })
    );

    for (const item of blogItems) {
      const isNew = await saveSummary(item);
      if (!isNew) continue;

      const tri = await aiSummarize3({
        title: item.title,
        baseSummary: item.summary,
        bodyText: item.bodyText,
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
          ai_model: "gpt-4o-mini",
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
