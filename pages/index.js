// pages/index.js
import { useState } from "react";
import Head from "next/head";
import { XMLParser } from "fast-xml-parser";

import SummaryTab from "../components/home/SummaryTab";
import DetailsTab from "../components/home/DetailsTab";
import QnaTab from "../components/home/QnaTab";

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
        </nav>

        {/* 탭 내용 */}
        {activeTab === "summary" && (
          <SummaryTab phone={PHONE} youtubeItems={youtubeItems} blogItems={blogItems} />
        )}

        {activeTab === "details" && <DetailsTab phone={PHONE} />}

        {activeTab === "qna" && <QnaTab />}
      </main>

      {/* 모바일 하단 고정 전화바 (탭과 무관) */}
      <a href={`tel:${PHONE}`} className="fixed-call-bar">
        <div className="fixed-call-bar-text">📞 중앙열쇠 전화하기</div>
      </a>
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

  return {
    props: {
      youtubeItems,
      blogItems,
    },
  };
}
