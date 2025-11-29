// components/home/SummaryTab.js
export default function SummaryTab({
  phone,
  youtubeItems,
  blogItems,
  youtubeUrl,
  blogUrl,
  mapEmbedUrl,
  mapLinkUrl,
}) {
  return (
    <>
      {/* 가게 한눈에 보기 + 지도 + 링크 */}
      <section className="card">
        <h2 className="section-title">가게 한눈에 보기</h2>

        <ul className="info-list">
          <li className="info-item">
            <span className="info-label">상호</span> 중앙열쇠
          </li>
          <li className="info-item">
            <span className="info-label">전화</span>
            <a href={`tel:${phone}`}>{phone}</a>
          </li>
          <li className="info-item">
            <span className="info-label">위치</span>
            대구광역시 동구 검사동 (대구 전 지역 출장)
          </li>
          <li className="info-item">
            <span className="info-label">서비스</span>
            자동차 키 복사 · 수입차 스마트키 · 폴딩키 · 도어락 설치/교체
          </li>
          <li className="info-item">
            <span className="info-label">문의</span> 24시간 전화 상담 가능
          </li>
        </ul>

        {/* 지도 미니뷰 */}
        <div className="map-wrapper">
          <a href={mapLinkUrl} target="_blank" rel="noopener noreferrer">
            <iframe
              className="map-frame"
              src={mapEmbedUrl}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="중앙열쇠 위치"
            />
          </a>
          <div className="map-caption">
            주변 지도를 보려면 지도를 탭하세요.
          </div>
        </div>

        {/* 유튜브 / 블로그 / 텔레그램 빠른 링크 */}
        <div className="quick-link-row">
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="quick-link-button"
          >
            📺 유튜브 채널
          </a>
          <a
            href={blogUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="quick-link-button"
          >
            📝 블로그
          </a>
        </div>
      </section>

      {/* 유튜브 최신 3개 */}
      <section className="card">
        <div className="section-header-row">
          <h2 className="section-title">유튜브 최신 영상</h2>
          <span className="section-sub-label">스마일유 채널</span>
        </div>

        {youtubeItems.length === 0 ? (
          <p className="muted-text">불러올 수 있는 영상이 없습니다.</p>
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

      {/* 블로그 최신 3개 */}
      <section className="card">
        <div className="section-header-row">
          <h2 className="section-title">블로그 최신 글</h2>
          <span className="section-sub-label">네이버 블로그</span>
        </div>

        {blogItems.length === 0 ? (
          <p className="muted-text">불러올 수 있는 글이 없습니다.</p>
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
    </>
  );
}
