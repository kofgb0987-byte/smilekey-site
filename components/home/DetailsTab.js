// components/home/DetailsTab.js
export default function DetailsTab({ phone }) {
  return (
    <>
      {/* 상세 소개 */}
      <section className="card">
        <h2 className="section-title">중앙열쇠 소개</h2>
        <p className="body-text">
          중앙열쇠는 <strong>대구광역시 동구 검사동</strong>에 위치한 자동차 키 ·
          도어락 전문 열쇠집입니다. 국산차는 물론{" "}
          <strong>벤츠, BMW, 아우디, 폭스바겐</strong> 등 수입차 스마트키와
          폴딩키 작업을 다수 진행해 왔습니다.
        </p>
        <p className="body-text">
          차량 키를 잃어버렸거나 예비키가 필요할 때, 오래된 현관 열쇠를{" "}
          <strong>디지털 도어락</strong>으로 바꾸고 싶을 때 편하게 전화 주세요.
          <strong> 대구 전 지역 출장</strong>이 가능하며, 상황에 맞게 가장
          현실적인 방법을 안내해 드립니다.
        </p>
      </section>

      {/* 서비스 상세 1 */}
      <section className="card">
        <h2 className="section-title">자동차 키 복사 · 제작</h2>
        <p className="body-text">
          국산 승용차, SUV, 화물차 등 대부분의 차량에 대해{" "}
          <strong>스마트키, 폴딩키, 일반키</strong> 복사와 예비키 제작이
          가능합니다. 키가 하나뿐이라면 분실 전에 예비키를 만들어 두는 것이
          비용과 시간 측면에서 훨씬 유리합니다.
        </p>
        <ul className="service-list">
          <li className="service-item">• 국산차 스마트키 / 폴딩키 복사</li>
          <li className="service-item">• 예비키 제작 및 분실 대비 키 제작</li>
          <li className="service-item">
            • 오래된 금속 키를 폴딩키로 개조 (차량에 따라 상이)
          </li>
        </ul>
      </section>

      {/* 서비스 상세 2 */}
      <section className="card">
        <h2 className="section-title">수입차 키 · 스마트키</h2>
        <p className="body-text">
          <strong>벤츠, BMW, 아우디, 폭스바겐</strong> 등 수입차의 키 작업도
          가능하지만, 차종과 연식에 따라 장비/보안 이슈로 제한이 있을 수
          있습니다. 차량 정보를 알려주시면 작업 가능 여부와 예상 비용을 먼저
          안내해 드립니다.
        </p>
        <ul className="service-list">
          <li className="service-item">• 수입차 스마트키 복사 / 예비키 제작</li>
          <li className="service-item">• 수입차 폴딩키 제작 및 교체</li>
          <li className="service-item">
            • 키 분실 시 현장 방문 후 신규 키 제작 (차량 상태에 따라 상이)
          </li>
        </ul>
      </section>

      {/* 서비스 상세 3 */}
      <section className="card">
        <h2 className="section-title">도어락 설치 · 교체</h2>
        <p className="body-text">
          가정집, 원룸, 상가, 사무실 등 현관{" "}
          <strong>도어락 신규 설치 및 교체</strong> 작업을 진행합니다. 기존
          열쇠방식에서 디지털 도어락으로 바꾸거나, 오래된 도어락이 고장 났을 때
          새 제품으로 교체해 드립니다.
        </p>
        <ul className="service-list">
          <li className="service-item">• 현관 도어락 신규 설치</li>
          <li className="service-item">• 노후 도어락 교체</li>
          <li className="service-item">• 간단한 도어락 오작동 점검 및 수리</li>
        </ul>
      </section>

      {/* 이용 안내 */}
      <section className="card">
        <h2 className="section-title">이용 안내</h2>
        <ul className="notice-list">
          <li className="notice-item">
            1. <strong>먼저 전화 주세요.</strong>
            <br />
            차량 종류, 키 상태(분실/예비키/폴딩키 개조 등)를 말씀해 주시면 작업
            가능 여부와 대략적인 비용을 안내해 드립니다. ({phone})
          </li>
          <li className="notice-item">
            2. <strong>방문 또는 출장 결정</strong>
            <br />
            위치와 상황에 따라 가게 방문이 좋은지, 차량/집으로 출장이 가능한지
            안내드립니다.
          </li>
          <li className="notice-item">
            3. <strong>현장 작업 후 함께 확인</strong>
            <br />
            키 인식, 시동, 도어락 작동 등을 함께 확인한 뒤 작업을 마무리합니다.
          </li>
        </ul>
      </section>

      {/* 위치 안내 */}
      <section className="card">
        <h2 className="section-title">위치 안내</h2>
        <p className="body-text">
          중앙열쇠는 <strong>대구광역시 동구 검사동</strong>에 있습니다. 방문
          전에는 꼭 전화로 가능 시간을 확인해 주세요. 차량 키 작업의 경우
          상황에 따라 <strong>현장 출장</strong>으로 진행되는 경우가 많습니다.
        </p>
        <p className="body-text">
          <strong>대구 전 지역</strong>을 대상으로 하며, 동구 · 수성구 · 북구
          지역은 비교적 빠른 방문이 가능합니다.
        </p>
        {/* 실제 지도 링크 있으면 여기 href 교체 */}
        {/* <a
          href="지도_링크"
          target="_blank"
          rel="noopener noreferrer"
          className="map-link"
        >
          지도에서 위치 보기
        </a> */}
      </section>
    </>
  );
}
