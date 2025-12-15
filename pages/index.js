// pages/index.js
import { useState } from "react";
import Head from "next/head";
import { XMLParser } from "fast-xml-parser";

import SummaryTab from "../components/home/SummaryTab";
import DetailsTab from "../components/home/DetailsTab";
import QnaTab from "../components/home/QnaTab";
import ChatWidget from "../components/common/ChatWidget";
const YOUTUBE_URL =
  "https://www.youtube.com/channel/UCRSiC2NpJQcvbHX6OdHV4VQ";
const BLOG_URL = "https://blog.naver.com/yym0072";
// 이건 네 텔레그램 아이디로 바꿔줘야 함
const TELEGRAM_URL = "https://t.me/your_telegram_username";
import ArchiveTab from "../components/home/ArchiveTab";
import crypto from "crypto";
import { saveSummary } from "../lib/redis";

// 구글 지도 embed / 링크 (주소 수정해도 됨)
const MAP_EMBED_URL =
  "https://www.google.com/maps?q=대구광역시+동구+검사동+중앙열쇠&output=embed";
const MAP_LINK_URL =
  "https://www.google.com/maps/search/?api=1&query=대구광역시+동구+검사동+중앙열쇠";


const PHONE = "010-3503-6919";

export default function Home({ youtubeItems, blogItems }) {
  const [activeTab, setActiveTab] = useState("summary");

  const businessJsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "중앙열쇠",
    url: "https://smilekey.me",
    telephone: PHONE,
    address: {
      "@type": "PostalAddress",
      addressCountry: "KR",
      addressLocality: "대구광역시 동구",
      streetAddress: "검사동",
    },
    areaServed: [
      "대구광역시 동구",
      "대구광역시 수성구",
      "대구광역시 북구",
      "대구광역시 달서구",
      "대구 전 지역",
    ],
    description:
      "대구 동구 검사동 중앙열쇠 – 자동차 키 복사, 수입차 스마트키, 폴딩키 제작, 차량 키 분실, 도어락 설치/교체까지 24시간 문의. 대구 전 지역 출장 가능.",
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ],
        opens: "00:00",
        closes: "23:59",
      },
    ],
    sameAs: [
      "https://www.youtube.com/channel/UCRSiC2NpJQcvbHX6OdHV4VQ",
      "https://blog.naver.com/yym0072",
    ],
  };

  return (
    <>
      <Head>
        <title>중앙열쇠 – 대구 자동차 키 · 수입차 스마트키 · 폴딩키 · 도어락 24시</title>
        <meta
          name="description"
          content="대구 동구 검사동 중앙열쇠 – 자동차 키 복사, 수입차 스마트키, 폴딩키 제작, 차량 키 분실, 도어락 설치/교체까지 24시간 문의. 대구 전 지역 출장 가능. 010-3503-6919"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        <meta property="og:title" content="중앙열쇠 – 대구 자동차 키 · 도어락 전문" />
        <meta
          property="og:description"
          content="대구 동구 검사동 중앙열쇠. 자동차 키 복사, 수입차 스마트키, 폴딩키 제작, 도어락 설치/교체 24시간 문의. 대구 전 지역 출장."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://smilekey.me" />
        <meta property="og:site_name" content="중앙열쇠" />
        <meta property="og:locale" content="ko_KR" />
        {/* og:image 필요하면 public 경로로 하나 지정해서 추가 */}
        {/* <meta property="og:image" content="https://smilekey.me/og-image.png" /> */}

        <link rel="canonical" href="https://smilekey.me" />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(businessJsonLd) }}
        />
      </Head>

      <main className="container">
        {/* 상단 헤더 + 큰 전화 버튼은 모든 탭 공통 */}
        <header className="header">
          <div className="header-badge">대구 동구 · 자동차 키 · 도어락</div>
          <h1 className="header-title">중앙열쇠</h1>
          <p className="header-sub">
            대구 자동차 키 · 수입차 스마트키 · 폴딩키 · 도어락 전문
          </p>
        </header>

        <section className="card">
          <a href={`tel:${PHONE}`} className="call-button">
            📞 {PHONE}
          </a>
          <p className="call-caption">
            차량 키 분실 · 예비키 · 폴딩키 · 도어락 문의는{" "}
            <strong>전화가 가장 빠릅니다.</strong>
          </p>
        </section>

        {/* 탭 네비게이션 */}
        <nav className="tab-nav">
          <button
            type="button"
            className={`tab-button ${
              activeTab === "summary" ? "tab-button--active" : ""
            }`}
            onClick={() => setActiveTab("summary")}
          >
            한눈에 보기
          </button>
          <button
            type="button"
            className={`tab-button ${
              activeTab === "details" ? "tab-button--active" : ""
            }`}
            onClick={() => setActiveTab("details")}
          >
            상세 정보
          </button>
          <button
            type="button"
            className={`tab-button ${
              activeTab === "qna" ? "tab-button--active" : ""
            }`}
            onClick={() => setActiveTab("qna")}
          >
            Q&A
          </button>

            <button
  type="button"
  className={`tab-button ${
    activeTab === "archive" ? "tab-button--active" : ""
  }`}
  onClick={() => setActiveTab("archive")}
>
  요약 저장
</button>

        </nav>

        {/* 탭 내용 */}
        {activeTab === "summary" && (
          <SummaryTab
            phone={PHONE}
            youtubeItems={youtubeItems}
            blogItems={blogItems}
            youtubeUrl={YOUTUBE_URL}
            blogUrl={BLOG_URL}
            mapEmbedUrl={MAP_EMBED_URL}
            mapLinkUrl={MAP_LINK_URL}
            telegramUrl={TELEGRAM_URL}
          />
        )}


        {activeTab === "details" && <DetailsTab phone={PHONE} />}

        {activeTab === "qna" && <QnaTab />}

          {activeTab === "archive" && <ArchiveTab />}
      </main>

      {/* 모바일 하단 고정 전화바 (탭과 무관) */}
      <a href={`tel:${PHONE}`} className="fixed-call-bar">
        <div className="fixed-call-bar-text">📞 중앙열쇠 전화하기</div>
      </a>
      <ChatWidget />
    </>

  );
}

// ---- 서버에서 RSS 불러오기 ----
export async function getServerSideProps() {
  const parser = new XMLParser({ ignoreAttributes: false });

  const youtubeFeedUrl =
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCRSiC2NpJQcvbHX6OdHV4VQ";
  const blogFeedUrl = "https://blog.rss.naver.com/yym0072.xml";

  let youtubeItems = [];
  let blogItems = [];

  // 유튜브
  try {
    const ytRes = await fetch(youtubeFeedUrl);
    const ytXml = await ytRes.text();
    const ytData = parser.parse(ytXml);

    const entries = ytData.feed?.entry
      ? Array.isArray(ytData.feed.entry)
        ? ytData.feed.entry
        : [ytData.feed.entry]
      : [];

    youtubeItems = entries.slice(0, 3).map((entry) => {
      const title = entry.title || "";
      const link =
        (Array.isArray(entry.link)
          ? entry.link[0]["@_href"]
          : entry.link?.["@_href"]) || "";
      const published = entry.published || "";
      const thumb =
        entry["media:group"]?.["media:thumbnail"]?.["@_url"] || "";

      return {
        title,
        link,
        date: published?.slice(0, 10) || "",
        thumbnail: thumb,
      };
    });
  } catch (e) {
    console.error("YouTube RSS error:", e);
  }

  // 네이버 블로그
  try {
    const blogRes = await fetch(blogFeedUrl);
    const blogXml = await blogRes.text();
    const blogData = parser.parse(blogXml);

    const items = blogData.rss?.channel?.item
      ? Array.isArray(blogData.rss.channel.item)
        ? blogData.rss.channel.item
        : [blogData.rss.channel.item]
      : [];

    blogItems = items.slice(0, 3).map((item) => {
      const title = item.title || "";
      const link = item.link || "";
      const pubDate = item.pubDate || "";
      const description = item.description || "";

      let thumb = "";
      const imgMatch = description.match(/<img[^>]+src=['"]([^'">]+)['"]/i);
      if (imgMatch && imgMatch[1]) {
        thumb = imgMatch[1];
      }

      if (thumb.startsWith("http://")) {
        thumb = thumb.replace("http://", "https://");
      }

      const text = description.replace(/<[^>]*>?/gm, "").trim();
      const excerpt = text.length > 60 ? text.slice(0, 60).trim() + "…" : text;

      const proxyThumb = thumb
        ? `/api/image-proxy?url=${encodeURIComponent(thumb)}`
        : "";

      return {
        title,
        link,
        date: pubDate?.slice(0, 16) || "",
        thumbnail: proxyThumb,
        excerpt,
      };
    });
  } catch (e) {
    console.error("Blog RSS error:", e);
  }

    // ✅ RSS로 가져온 최신 글들을 Redis 요약 저장소에도 자동 저장
  try {
    const toSave = [];

    // 유튜브: 제목/링크/날짜/썸네일로 "임시 요약" 만들기
    for (const it of youtubeItems) {
      const id = crypto.createHash("sha1").update(`yt:${it.link}`).digest("hex");
      toSave.push({
        id,
        source: "youtube",
        title: it.title,
        link: it.link,
        date: it.date,
        thumbnail: it.thumbnail,
        summary: `유튜브 영상: ${it.title}`, // ✅ 일단 임시 요약(다음 단계에서 AI 요약으로 교체)
      });
    }

    // 블로그: excerpt를 요약으로 저장
    for (const it of blogItems) {
      const id = crypto.createHash("sha1").update(`blog:${it.link}`).digest("hex");
      toSave.push({
        id,
        source: "blog",
        title: it.title,
        link: it.link,
        date: it.date,
        thumbnail: it.thumbnail,
        summary: it.excerpt || it.title, // ✅ excerpt 있으면 그걸 요약으로
      });
    }

    // 저장(중복 방지는 saveSummary 내부에서 처리하게 만들어둔 상태)
    for (const item of toSave) {
      await saveSummary(item);
    }
  } catch (e) {
    console.error("Auto-save summaries error:", e);
  }



  return {
    props: {
      youtubeItems,
      blogItems,
    },
  };
}
