// pages/index.js
import Head from "next/head";
import { XMLParser } from "fast-xml-parser";

export default function Home({ youtubeItems, blogItems }) {
  const phone = "010-3503-6919";

  return (
    <>
      <Head>
        <title>중앙열쇠 – 대구 자동차 키 · 폴딩키 · 도어락 24시</title>
        <meta
          name="description"
          content="대구 동구 검사동 중앙열쇠 – 자동차 폴딩키, 자동차 키 복사, 키 분실, 도어락 설치/교체 24시간 문의. 010-3503-6919"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="container">
        {/* 상단 제목 */}
        <header className="header">
          <div style={{ fontSize: 14, marginBottom: 4 }}>
            대구 동구 · 열쇠 / 도어락
          </div>
          <h1 className="header-title">중앙열쇠</h1>
          <p className="header-sub">
            자동차 키 · 폴딩키 · 키복사 · 도어락 설치 / 교체
          </p>
        </header>

        {/* 제일 큰 전화 버튼 */}
        <section className="card">
          <a href={`tel:${phone}`} className="call-button">
            📞 {phone}
          </a>
          <div className="call-caption">
            궁금하신 점은 <strong>전화가 가장 빠릅니다.</strong>
          </div>
        </section>

        {/* 가게 기본 정보 */}
        <section className="card">
          <h2 className="section-title">가게 정보</h2>
          <ul className="info-list">
            <li className="info-item">
              <span className="info-label">상호</span> 중앙열쇠
            </li>
            <li className="info-item">
              <span className="info-label">전화</span>
              <a href={`tel:${phone}`}>{phone}</a>
            </li>
            <li className="info-item">
              <span className="info-label">주소</span>
              대구광역시 동구 검사동
            </li>
            <li className="info-item">
              <span className="info-label">시간</span> 24시간 문의 가능
            </li>
            <li className="info-item">
              <span className="info-label">지역</span> 대구 전 지역
            </li>
          </ul>
        </section>

        {/* 하는 일 (서비스) */}
        <section className="card">
          <h2 className="section-title">하는 일</h2>
          <ul className="service-list">
            <li className="service-item">• 자동차 폴딩키 제작 / 개조</li>
            <li className="service-item">
              • 스마트키 / 일반키 복사, 예비키 제작
            </li>
            <li className="service-item">
              • 자동차 키 분실 상담, 시동 안 걸림 관련 문의
            </li>
            <li className="service-item">
              • 현관 도어락 설치 / 교체 / 간단 수리
            </li>
            <li className="service-item">• 그 외 키 / 잠금 관련 문의</li>
          </ul>
        </section>

        {/* 유튜브 최신 영상 */}
        <section className="card">
          <h2 className="section-title">유튜브 최신 영상</h2>
          <p style={{ fontSize: 14, marginBottom: 10 }}>
            스마일유 채널에서 올린 최근 영상입니다.
          </p>
          {youtubeItems.length === 0 ? (
            <p style={{ fontSize: 14, color: "#777" }}>
              불러올 수 있는 영상이 없습니다.
            </p>
          ) : (
            <div className="thumb-list">
              {youtubeItems.map((item) => (
                <a
                  key={item.link}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="thumb-item"
                >
                  {item.thumbnail && (
                    <div className="thumb-image-wrapper">
                      <img
                        src={item.thumbnail}
                        alt={item.title}
                        className="thumb-image"
                      />
                    </div>
                  )}
                  <div className="thumb-text">
                    <div className="thumb-title">{item.title}</div>
                    <div className="thumb-date">{item.date}</div>
                    <div className="thumb-badge">영상 보러가기</div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        {/* 네이버 블로그 최신 글 */}
        <section className="card">
          <h2 className="section-title">블로그 최신 글</h2>
          <p style={{ fontSize: 14, marginBottom: 10 }}>
            네이버 블로그에 올라온 최근 글입니다.
          </p>
          {blogItems.length === 0 ? (
            <p style={{ fontSize: 14, color: "#777" }}>
              불러올 수 있는 글이 없습니다.
            </p>
          ) : (
            <div className="thumb-list">
              {blogItems.map((item) => (
                <a
                  key={item.link}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="thumb-item"
                >
                  {item.thumbnail && (
                    <div className="thumb-image-wrapper">
                      <img
                        src={item.thumbnail}
                        alt={item.title}
                        className="thumb-image"
                      />
                    </div>
                  )}
                  <div className="thumb-text">
                    <div className="thumb-title">{item.title}</div>
                    <div className="thumb-date">{item.date}</div>
                    <div className="thumb-excerpt">{item.excerpt}</div>
                    <div className="thumb-badge">블로그에서 보기</div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        {/* 이용 안내 (설명은 최대한 간단하게) */}
        <section className="card">
          <h2 className="section-title">이용 안내</h2>
          <ul className="notice-list">
            <li className="notice-item">
              1. <strong>먼저 전화 주세요.</strong>
              <br />
              차량 종류, 키 상태(분실/예비키/폴딩키 개조 등)를 말씀해 주시면
              작업 가능 여부와 대략 비용을 알려드립니다.
            </li>
            <li className="notice-item">
              2. <strong>방문 또는 출장</strong>
              <br />
              위치에 따라 방문이 좋을지, 출장 가능한지 안내해 드립니다.
            </li>
            <li className="notice-item">
              3. <strong>작업 후 확인</strong>
              <br />
              키 인식 / 시동 / 도어락 작동을 함께 확인한 후 마무리합니다.
            </li>
          </ul>
        </section>

        {/* 푸터 */}
        <footer className="footer">
          © {new Date().getFullYear()} 중앙열쇠 · 대구광역시 동구 검사동 · Tel.{" "}
          {phone}
        </footer>

        {/* 모바일용 하단 전화 고정바 */}
        <a href={`tel:${phone}`} className="fixed-call-bar">
          <div className="fixed-call-bar-text">📞 중앙열쇠 전화하기</div>
        </a>
      </main>
    </>
  );
}

// ---- 서버에서 RSS 불러오기 ----
export async function getServerSideProps() {
  const parser = new XMLParser({ ignoreAttributes: false });

  // 유튜브 RSS
  const youtubeFeedUrl =
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCRSiC2NpJQcvbHX6OdHV4VQ";

  // 네이버 블로그 RSS
  const blogFeedUrl = "https://blog.rss.naver.com/yym0072.xml";

  let youtubeItems = [];
  let blogItems = [];

  try {
    // 유튜브
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
    // 네이버 블로그
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

      // description 안에서 첫 번째 이미지 src 추출
      let thumb = "";
      const imgMatch = description.match(/<img[^>]+src="([^">]+)"/i);
      if (imgMatch && imgMatch[1]) {
        thumb = imgMatch[1];
      }

      // 텍스트만 추출 (태그 제거)
      const text = description.replace(/<[^>]*>?/gm, "").trim();
      const excerpt =
        text.length > 60 ? text.slice(0, 60).trim() + "…" : text;

      return {
        title,
        link,
        date: pubDate?.slice(0, 16) || "",
        thumbnail: thumb,
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
