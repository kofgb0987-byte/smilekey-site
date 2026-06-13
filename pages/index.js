// pages/index.js
import { useState } from "react";
import Head from "next/head";
import { XMLParser } from "fast-xml-parser";
import { listSummaryIds, getSummary } from "../lib/redis";

import SummaryTab from "../components/home/SummaryTab";
import DetailsTab from "../components/home/DetailsTab";
import QnaTab from "../components/home/QnaTab";
import ArchiveTab from "../components/home/ArchiveTab";

const YOUTUBE_URL = "https://www.youtube.com/channel/UCRSiC2NpJQcvbHX6OdHV4VQ";
const BLOG_URL = "https://blog.naver.com/yym0072";
const MAP_EMBED_URL =
  "https://www.google.com/maps?q=대구광역시+동구+검사동+중앙열쇠&output=embed";
const MAP_LINK_URL =
  "https://www.google.com/maps/search/?api=1&query=대구광역시+동구+검사동+중앙열쇠";
const PHONE = "010-3503-6919";

const TABS = [
  { id: "summary", label: "한눈에 보기" },
  { id: "details", label: "상세 정보" },
  { id: "qna", label: "Q&A" },
  { id: "archive", label: "요약 저장" },
];

export default function Home({ youtubeItems, blogItems, archiveItems }) {
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
        <meta name="naver-site-verification" content="79109bc1dbbc4d37a7a11af489ea0109c0829c03" />

        <meta property="og:title" content="중앙열쇠 – 대구 자동차 키 · 도어락 전문" />
        <meta
          property="og:description"
          content="대구 동구 검사동 중앙열쇠. 자동차 키 복사, 수입차 스마트키, 폴딩키 제작, 도어락 설치/교체 24시간 문의. 대구 전 지역 출장."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://smilekey.me" />
        <meta property="og:site_name" content="중앙열쇠" />
        <meta property="og:locale" content="ko_KR" />
        <meta property="og:image" content="https://smilekey.me/og-image.png" />

        <link rel="canonical" href="https://smilekey.me" />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(businessJsonLd) }}
        />
      </Head>

      <main className="container">
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

        <div className="promo-badge">
          🎁 <strong>홈페이지 보고 연락 시 10% 할인</strong>
          <span className="promo-sub"> (일부 품목 제외, 최대 5만원)</span>
        </div>

        <nav className="tab-nav" role="tablist" aria-label="메뉴">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`tab-button ${activeTab === tab.id ? "tab-button--active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div role="tabpanel">
          {activeTab === "summary" && (
            <SummaryTab
              phone={PHONE}
              youtubeItems={youtubeItems}
              blogItems={blogItems}
              youtubeUrl={YOUTUBE_URL}
              blogUrl={BLOG_URL}
              mapEmbedUrl={MAP_EMBED_URL}
              mapLinkUrl={MAP_LINK_URL}
              archiveItems={archiveItems}
            />
          )}
          {activeTab === "details" && (
            <DetailsTab phone={PHONE} mapLinkUrl={MAP_LINK_URL} />
          )}
          {activeTab === "qna" && <QnaTab />}
          {activeTab === "archive" && <ArchiveTab />}
        </div>
      </main>

      <a href={`tel:${PHONE}`} className="fixed-call-bar">
        <div className="fixed-call-bar-text">📞 중앙열쇠 전화하기</div>
      </a>
    </>
  );
}

export async function getStaticProps() {
  const parser = new XMLParser({ ignoreAttributes: false });

  const youtubeFeedUrl =
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCRSiC2NpJQcvbHX6OdHV4VQ";
  const blogFeedUrl = "https://blog.rss.naver.com/yym0072.xml";

  let youtubeItems = [];
  let blogItems = [];

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

  let archiveItems = [];
  try {
    const ids = await listSummaryIds(3);
    const raw = await Promise.all(
      ids.map(async (id) => {
        const it = await getSummary(id);
        return it ? { ...it, id } : null;
      })
    );
    archiveItems = raw.filter(Boolean);
  } catch (e) {
    console.error("ArchiveItems load error:", e);
  }

  return {
    props: {
      youtubeItems,
      blogItems,
      archiveItems,
    },
    revalidate: 300,
  };
}
