// lib/official.js — 공공기관 공식 소스 (type: "official")
//   1) 대구시청 시정뉴스 RSS — 키 불필요, 항상 사용
//   2) 한국관광공사 TourAPI 축제/행사 — TOUR_API_KEY(data.go.kr 일반 인증키) 있으면 사용
//      → 행사 시작일/종료일/장소가 공식 데이터라 날짜 정확도가 높음

import { XMLParser } from "fast-xml-parser";

function stripTags(s = "") {
  return String(s)
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// ── 1) 대구시청 시정뉴스 RSS ──
export async function fetchDaeguCityNews({ days = 3, max = 20 } = {}) {
  const res = await fetch("https://info.daegu.go.kr/rss/rss.php?sgidx=1", {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`daegu rss failed ${res.status}`);

  const parser = new XMLParser({ ignoreAttributes: false });
  const data = parser.parse(await res.text());
  const raw = data.rss?.channel?.item;
  const items = raw ? (Array.isArray(raw) ? raw : [raw]) : [];

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  return items
    .map((item) => {
      const date = String(item.pubDate || "").slice(0, 10); // "2026-07-24"
      const d = new Date(`${date}T00:00:00+09:00`);
      const image =
        String(item.thumbnail || "").trim() ||
        String(item.enclosure?.["@_url"] || "").trim();
      return {
        type: "official",
        query: "대구시청 시정뉴스",
        title: stripTags(item.title),
        description: `대구광역시 공식 발표(${stripTags(item.category) || "시정소식"})`,
        link: String(item.link || "").trim(),
        date,
        image: image.startsWith("http") ? image : "",
        _ts: d && !isNaN(d) ? d.getTime() : 0,
      };
    })
    .filter((it) => it.title && it.link && it._ts >= cutoff)
    .slice(0, max)
    .map(({ _ts, ...rest }) => rest);
}

// ── 2) 한국관광공사 TourAPI 축제/행사 (대구=4, 경북=35) ──
async function tourApiSearch(base, key, areaCode, eventStartDate) {
  const url =
    `${base}?serviceKey=${encodeURIComponent(key)}` +
    `&numOfRows=50&pageNo=1&MobileOS=ETC&MobileApp=smilekey&_type=json` +
    `&arrange=D&eventStartDate=${eventStartDate}&areaCode=${areaCode}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`tourapi http ${res.status}`);
  const data = await res.json();
  const items = data?.response?.body?.items?.item;
  return items ? (Array.isArray(items) ? items : [items]) : [];
}

function fmtYmd(ymd = "") {
  const s = String(ymd);
  return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s;
}

export async function fetchTourApiFestivals({ max = 30 } = {}) {
  const key = process.env.TOUR_API_KEY;
  if (!key) return [];

  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayYmd = now.toISOString().slice(0, 10).replace(/-/g, "");
  // 진행 중 행사 포함을 위해 30일 전 시작 행사부터 조회 후 종료일로 필터
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10).replace(/-/g, "");

  const bases = [
    "https://apis.data.go.kr/B551011/KorService2/searchFestival2",
    "https://apis.data.go.kr/B551011/KorService1/searchFestival1",
  ];

  let items = [];
  for (const base of bases) {
    try {
      const daegu = await tourApiSearch(base, key, 4, from);
      const gb = await tourApiSearch(base, key, 35, from);
      items = [...daegu, ...gb];
      break; // 성공한 버전 사용
    } catch (e) {
      console.error(`tourapi error (${base}):`, e.message);
    }
  }

  return items
    .filter((it) => String(it.eventenddate || "") >= todayYmd) // 종료된 행사 제외
    .slice(0, max)
    .map((it) => ({
      type: "official",
      query: "한국관광공사 행사데이터",
      title: stripTags(it.title),
      description:
        `행사기간 ${fmtYmd(it.eventstartdate)}~${fmtYmd(it.eventenddate)}` +
        (it.addr1 ? ` · 장소 ${stripTags(it.addr1)}` : "") +
        " (한국관광공사 공식 행사데이터)",
      // 고유 dedup 키 용도 — http가 아니므로 화면에선 텍스트로만 표시됨
      link: `kto:${it.contentid || it.title}`,
      date: fmtYmd(it.eventstartdate),
      image: String(it.firstimage || it.firstimage2 || "").trim(),
    }));
}
