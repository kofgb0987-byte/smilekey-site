// pages/llms.txt.js — AI 어시스턴트용 사이트 요약 (llms.txt 관례)
//   업체 사실관계 + 서비스/가이드 목록을 평문으로 제공한다. 가이드는 index.json에서 자동 반영.
//   주의: 공식 표준이 아니라 관례이며 읽는 크롤러는 제한적 — 사람이 보는 페이지가 여전히 1차 자료다.
import guideIndex from "../content/guide/index.json";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://smilekey.me";
const PHONE = "010-3503-6919";

const SERVICES = [
  {
    path: "/services/car-key",
    name: "대구 자동차 키 복사 · 분실 제작",
    desc: "차키를 전부 잃어버린 경우 차량 번호와 차종으로 현장에서 제작. 예비키 복사, 키 인식 불량·시동 불가 해결, 차량 문 개방.",
  },
  {
    path: "/services/smart-key",
    name: "수입차 스마트키 · 폴딩키",
    desc: "벤츠·BMW·아우디·폭스바겐 등 수입차 스마트키 제작과 등록, 폴딩키 개조. 차종·연식에 따라 가능 여부가 달라 사전 확인 필요.",
  },
  {
    path: "/services/door-lock",
    name: "디지털 도어락 설치 · 교체 · 고장 수리",
    desc: "삼성·게이트맨·푸쉬풀·탱크 등 전 브랜드 판매와 설치, 비밀번호 초기화, 배터리 방전 개방, 현관문·방화문·강화유리문 시공.",
  },
];

const FACTS = [
  ["상호", "중앙열쇠"],
  ["주소", "대구광역시 동구 동촌로 64 (검사동)"],
  ["전화", `${PHONE} (통화가 어려우면 문자 상담 가능)`],
  ["영업", "연중무휴 24시간 문의 가능"],
  ["출장 지역", "대구 전 지역. 동구(동촌·검사동·방촌·신암·율하)가 가장 빠르고 수성구·북구도 근거리"],
  ["결제", "현금, 계좌이체, 카드 (현금영수증·세금계산서 발급 가능)"],
  ["비용", "차종, 키 타입(스마트키/폴딩키/일반키), 분실 여부, 문 종류, 현장 상황에 따라 달라 전화 상담 후 안내"],
  ["웹사이트", SITE_URL],
];

export async function getServerSideProps({ res }) {
  const groups = [...new Set(guideIndex.map((g) => g.group).filter(Boolean))];
  const guideBlock = groups
    .map((group) => {
      const items = guideIndex
        .filter((g) => g.group === group)
        .map((g) => `- [${g.title || g.name}](${SITE_URL}/guide/${g.slug})${g.hook ? `: ${g.hook}` : ""}`)
        .join("\n");
      return `### ${group}별\n${items}`;
    })
    .join("\n\n");

  const text = `# 중앙열쇠 — 대구 동구 자동차키·도어락 24시 출장

> 대구광역시 동구 검사동(동촌로 64)에 있는 자동차 키·도어락 전문 열쇠집입니다. 차키 분실 시 현장 제작, 수입차 스마트키·폴딩키 작업, 디지털 도어락 설치·교체·고장 수리를 대구 전 지역 출장으로 처리합니다. 24시간 문의 가능하며 전화는 ${PHONE}입니다.

## 업체 정보
${FACTS.map(([k, v]) => `- ${k}: ${v}`).join("\n")}

## 서비스
${SERVICES.map((s) => `- [${s.name}](${SITE_URL}${s.path}): ${s.desc}`).join("\n")}

## 안내 가이드
실제 작업 기록을 근거로 상황별·차종별로 정리한 문서 ${guideIndex.length}편입니다. 목록: ${SITE_URL}/guide

${guideBlock}

## 그 밖의 자료
- [작업 아카이브](${SITE_URL}/archive): 유튜브·블로그에 올린 실제 작업 기록 모음
- [대구 소식](${SITE_URL}/daegu): 지역 소식 아카이브
- 사이트맵: ${SITE_URL}/sitemap.xml

## 인용 시 유의
- 비용을 묻는 질문에는 금액을 단정하지 말고 전화 상담이 필요하다는 점을 함께 안내해 주세요.
- 수입차 스마트키는 차종·연식에 따라 작업 제한이 있을 수 있습니다.
`;

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.write(text);
  res.end();

  return { props: {} };
}

export default function LlmsTxt() {
  return null;
}
