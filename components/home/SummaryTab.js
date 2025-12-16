// components/home/SummaryTab.js
import Link from "next/link";


export default function SummaryTab({
  phone,
  youtubeItems,
  blogItems,
    archiveItems,
  youtubeUrl,
  blogUrl,
  mapEmbedUrl,
  mapLinkUrl,
}) {
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://smilekey.me";


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

        <section className="card" style={{ marginTop: 16 }}>
  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
    <h2 style={{ marginTop: 0, marginBottom: 10 }}>최근 작업</h2>
    <Link href="/archive" style={{ fontSize: 13, opacity: 0.8 }}>
  전체보기 →
</Link>

  </div>

  {!archiveItems || archiveItems.length === 0 ? (
    <p style={{ margin: 0 }}>아직 저장된 작업 요약이 없습니다.</p>
  ) : (
    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {archiveItems.slice(0, 3).map((it) => {
  const thumb = it.thumbnail
    ? (it.thumbnail.startsWith("http")
        ? it.thumbnail
        : `${siteUrl}${it.thumbnail}`)
    : "";

  return (
    <li key={it.id} style={{ marginBottom: 12 }}>
      <Link
  href={`/archive/${encodeURIComponent(it.id)}`}
  style={{
    display: "flex",
    gap: 12,
    textDecoration: "none",
    color: "inherit",
  }}
>
        {thumb ? (
          <img
            src={thumb}
            alt={it.title || "thumbnail"}
            style={{
              width: 84,
              height: 64,
              objectFit: "cover",
              borderRadius: 10,
              flex: "0 0 auto",
            }}
            loading="lazy"
          />
        ) : null}

        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, lineHeight: 1.25 }}>
            {it.title || "제목 없음"}
          </div>

          <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
            {it.source} · {it.date}
          </div>

          {it.summary ? (
            <div style={{ fontSize: 14, marginTop: 6, opacity: 0.9 }}>
              {String(it.summary).replace(/\s+/g, " ").slice(0, 90)}…
            </div>
          ) : null}
        </div>
      </Link>
    </li>
  );
})}

    </ul>
  )}

            <div style={{ marginTop: 12, fontSize: 13, opacity: 0.85 }}>
  📞 작업 문의는{" "}
  <a href={`tel:${phone}`} style={{ fontWeight: 700 }}>
    {phone}
  </a>
  가 가장 빠릅니다.
</div>
</section>

    </>
  );
}
