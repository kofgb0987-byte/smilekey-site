// pages/index.js
import Head from "next/head";

export default function Home() {
  const phone = "010-3503-6919";
  const mapQuery = "대구 동구 검사동 1018-9";

  return (
    <>
      <Head>
        <title>중앙열쇠 – 대구 자동차 키 · 폴딩키 · 도어락 24시</title>
        <meta
          name="description"
          content="대구 동구 중앙열쇠 – 자동차 폴딩키, 자동차 키 복사, 키 분실, 도어락 설치/교체 24시간 문의. 010-3503-6919"
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />
      </Head>

      <main className="container">
        {/* 상단 제목 */}
        <header className="header">
          <div style={{ fontSize: 14, marginBottom: 4 }}>대구 동구 · 열쇠 / 도어락</div>
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
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  mapQuery
                )}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                대구 동구 검사동 1018-9
              </a>
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
            <li className="service-item">
              • 자동차 폴딩키 제작 / 개조
            </li>
            <li className="service-item">
              • 스마트키 / 일반키 복사, 예비키 제작
            </li>
            <li className="service-item">
              • 자동차 키 분실 상담, 시동 안 걸림 관련 문의
            </li>
            <li className="service-item">
              • 현관 도어락 설치 / 교체 / 간단 수리
            </li>
            <li className="service-item">
              • 그 외 키 / 잠금 관련 문의
            </li>
          </ul>
        </section>

        {/* 이용 안내 (설명은 최대한 간단하게) */}
        <section className="card">
          <h2 className="section-title">이용 안내</h2>
          <ul className="notice-list">
            <li className="notice-item">
              1. <strong>먼저 전화 주세요.</strong>
              <br />
              차량 종류, 키 상태(분실/예비키/폴딩키 개조 등)를 말씀해 주시면
              <br />
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
          © {new Date().getFullYear()} 중앙열쇠 · 1018-9 Geomsa-dong, Dong-gu,
          Daegu · Tel. {phone}
        </footer>

        {/* 모바일용 하단 전화 고정바 */}
        <a href={`tel:${phone}`} className="fixed-call-bar">
          <div className="fixed-call-bar-text">📞 중앙열쇠 전화하기</div>
        </a>
      </main>
    </>
  );
}
