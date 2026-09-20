#!/usr/bin/env node
// scripts/guide-topics-add-models.mjs — 모델 단위·지역 단위 가이드 주제를 topics.json에 추가 (1회성, 중복 slug는 건너뜀)
//   node scripts/guide-topics-add-models.mjs
// 왜: 브랜드 단위(기아·현대…) 가이드는 "레이 차키분실"처럼 사람들이 실제로 치는 검색어와 한 단계 어긋난다.
//     아카이브(2026-09-18 기준 387건)에서 제목+요약 5건 이상인 모델만 골랐다. 지역은 근거가 있는 경산·영천만.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "content", "guide", "topics.json");
const j = JSON.parse(fs.readFileSync(FILE, "utf8"));

// 정규식은 title + summary_ko 에 대해 i 플래그로 평가된다(scripts/guide-write.mjs pickEvidence).
const CAR_EX = "툴레|THULE|루프박스|자전거|캐리어";
const model = (slug, name, query, match, service, angle, minCases = 5, exclude = CAR_EX) => ({ slug, name, query, angle, match, exclude, service, group: "차종", minCases });

const add = [
  // 현대
  model("hyundai-grandeur", "그랜저 차키·스마트키 분실", "그랜저 스마트키 분실 대구", "그랜저", "car-key",
    "그랜저 세대(TG·HG·IG·GN7)별로 키 방식이 다르다는 점을 사례 기준으로. 스마트키 전량 분실 시 현장 등록 흐름, 소요 시간은 사례에 나온 범위만."),
  model("hyundai-avante", "아반떼 차키 분실·복사", "아반떼 차키 분실 대구", "아반떼", "car-key",
    "아반떼 연식별 폴딩키/스마트키 구분, 분실 제작과 예비키 복사의 차이. 사례에 나온 모델명(MD·AD·CN7 등)만 언급."),
  model("hyundai-sonata", "쏘나타 스마트키 분실·키박스", "쏘나타 스마트키 분실 대구", "쏘나타|소나타", "car-key",
    "쏘나타 DN8 하이브리드 전량 분실 현장 제작, 구형 시동키박스 고장 수리 사례를 함께. 견인 없이 현장 처리가 핵심."),
  // 기아
  model("kia-ray", "기아 레이 차키 분실 제작", "레이 차키 분실 대구", "기아 ?레이|레이 ?(차키|스마트키|키|분실|폴딩)|레이차키", "car-key",
    "레이는 대구에서 가장 자주 들어오는 모델. 폴딩키·스마트키 두 방식이 섞여 있음을 사례로 설명. 경차라 저렴하다는 식의 가격 단정은 금지."),
  model("kia-morning", "기아 모닝 차키 분실·폴딩키", "모닝 차키 분실 대구", "모닝", "car-key",
    "모닝 연식별(TA·JA) 폴딩키 제작과 스마트키 등록 사례. 리모컨 불량과 분실을 구분."),
  model("kia-carnival", "카니발 스마트키 분실", "카니발 스마트키 분실 대구", "카니발", "car-key",
    "카니발(그랜드·올뉴·KA4) 스마트키 전량 분실 현장 제작 사례. 가족 차량이라 급한 상황이 많다는 맥락은 사례에 있을 때만."),
  model("kia-k5", "K5 스마트키 분실", "K5 스마트키 분실 대구", "K5", "car-key",
    "K5 세대별 스마트키 등록 사례 중심. 근거가 적으니 사례에 없는 세대는 언급하지 말 것."),
  // 쉐보레
  model("chevrolet-spark", "스파크 차키 분실·리모컨키", "스파크 차키 분실 대구", "스파크", "car-key",
    "스파크 폴딩키·리모컨키 제작과 케이스 교체, 이그니션 고장 사례. 경차 특성 언급은 사례 기준."),
  model("chevrolet-cruze", "크루즈 차키 분실·키박스", "크루즈 차키 분실 대구", "크루즈", "car-key",
    "크루즈 폴딩키 제작과 시동키박스 수리 사례. 쉐보레 계열 공통 절차는 한 문단으로."),
  // 르노(삼성)
  model("renault-sm3", "SM3 스마트키·카드키 분실", "SM3 스마트키 분실 대구", "SM3", "smart-key",
    "SM3 카드키/노브형 스마트키 방식 구분과 전량 분실 등록 사례. 르노 카드키 특성은 사례에 있을 때만."),
  model("renault-sm5", "SM5 스마트키 분실 제작", "SM5 스마트키 분실 대구", "SM5", "smart-key",
    "SM5 노브형 스마트키·카드키 세대별 사례. 대구에서 르노 계열 중 가장 많음."),
  model("renault-sm6", "SM6 스마트키 분실", "SM6 스마트키 분실 대구", "SM6", "smart-key",
    "SM6 카드형 스마트키 전량 분실·추가 등록 사례."),
  model("renault-sm7", "SM7 스마트키·카드키 분실", "SM7 스마트키 분실 대구", "SM7", "smart-key",
    "SM7 카드키 분실과 등록 사례. 노브형/카드형 구분."),
  model("renault-qm3", "QM3 스마트키 분실", "QM3 스마트키 분실 대구", "QM3", "smart-key",
    "QM3 카드키 전량 분실 현장 제작·등록 사례. 수입 생산(르노 캡처) 특성은 사례 기준."),
  // 폭스바겐
  model("vw-golf", "폭스바겐 골프 키 분실·키박스", "골프 스마트키 분실 대구", "골프", "smart-key",
    "골프 세대별 폴딩키/스마트키, 이그니션 키박스 수리 사례. 폭스바겐 이모빌라이저 등록 절차는 사례 표현 범위에서."),
  model("vw-beetle", "폭스바겐 비틀 시동키·키박스 수리", "뉴비틀 시동키 안돌아감", "비틀", "smart-key",
    "뉴비틀 시동키가 안 돌아가는 이그니션 마모·키박스 수리 사례가 핵심. 롱롱키(수신거리) 제작 사례 포함."),
  model("vw-tiguan", "티구안 스마트키 분실", "티구안 스마트키 분실 대구", "티구안", "smart-key",
    "티구안 스마트키 전량 분실·추가 제작 사례."),
  // 수입 프리미엄·볼보
  model("mercedes-benz", "벤츠 스마트키 분실·추가 제작", "벤츠 스마트키 분실 대구", "벤츠|메르세데스|Benz", "smart-key",
    "벤츠 스마트키 전량 분실과 추가 제작 사례. 차대별(W205·W213 등) 제한은 사례에 나온 것만, '시간이 걸릴 수 있다'는 유보 표현 허용."),
  model("volvo", "볼보 스마트키 분실·차문 개방", "볼보 스마트키 분실 대구", "볼보|Volvo", "smart-key",
    "볼보 XC90 등 차문 잠김 개방과 스마트키 제작 사례."),
  // 오토바이 모델
  model("honda-pcx", "혼다 PCX 스마트키 분실 제작", "PCX 스마트키 분실", "PCX", "smart-key",
    "PCX 스마트키 전량 분실 시 안장(시트) 개방 → 비상키 제작 → 등록 흐름. 아이디·시리얼 번호 복원 사례. 연식별 시스템 차이는 유보 표현.", 5, "자전거|캐리어"),
  model("yamaha-nmax", "야마하 NMAX 스마트키 분실", "NMAX 스마트키 분실", "NMAX|엔맥스", "smart-key",
    "NMAX(엔맥스) 스마트키 분실 제작·등록 사례. PCX와의 차이는 사례에 있을 때만.", 5, "자전거|캐리어"),

  // ── 2차(2026-09-20, 근거 기준 3건으로 완화 — 사용자 결정) ──
  // 네이버 검색광고 월간 검색량: 제네시스차키 1,690·스마트키 680 / BMW차키 1,320·스마트키 630 / 쏘렌토 590·380 /
  // 싼타페 350·200 / 스포티지 330 / 셀토스 240 / QM6 190 / 렉서스 140·90 / 말리부 120 / 올란도 100. 근거는 3~4건이라 단정 금지 톤.
  model("hyundai-genesis", "제네시스 스마트키 분실·차키 제작", "제네시스 스마트키 분실 대구", "제네시스|Genesis|G70|G80|G90|GV70|GV80|GV60|G380", "smart-key",
    "제네시스 스마트키 전량 분실·추가 제작 사례. 근거가 3~4건이라 세대(DH·G80·GV80 등)는 사례에 나온 것만 말하고 나머지는 전화 확인으로.", 3),
  model("bmw", "BMW 스마트키 분실·차키 제작", "BMW 스마트키 분실 대구", "BMW|비엠더블유", "smart-key",
    "BMW 스마트키 분실·추가 제작(Z4 등) 사례. 미니쿠퍼는 별도 가이드(imported-premium)라 제외. 차대별 제한은 유보 표현.", 3),
  model("kia-sorento", "쏘렌토 스마트키 분실", "쏘렌토 스마트키 분실 대구", "쏘렌토|소렌토", "car-key",
    "쏘렌토 세대별 스마트키 분실·현장 제작 사례. 근거 적음 — 사례 범위에서만.", 3),
  model("hyundai-santafe", "싼타페 스마트키 분실", "싼타페 스마트키 분실 대구", "싼타페|산타페", "car-key",
    "싼타페 스마트키·폴딩키 분실 제작 사례. 근거 적음 — 사례 범위에서만.", 3),
  model("kia-sportage", "스포티지 스마트키 분실", "스포티지 스마트키 분실 대구", "스포티지", "car-key",
    "스포티지 스마트키 분실·제작 사례. 근거 적음 — 사례 범위에서만.", 3),
  model("kia-seltos", "셀토스 스마트키 분실", "셀토스 스마트키 분실 대구", "셀토스", "car-key",
    "셀토스 스마트키 분실·제작 사례. 근거 적음 — 사례 범위에서만.", 3),
  model("renault-qm6", "QM6 스마트키 분실", "QM6 스마트키 분실 대구", "QM6", "smart-key",
    "QM6 카드키·스마트키 분실 제작 사례. QM3와 혼동하지 않게 모델명 명확히.", 3),
  model("lexus", "렉서스 스마트키 분실", "렉서스 스마트키 분실 대구", "렉서스|Lexus", "smart-key",
    "렉서스 스마트키 분실·차문 개방 사례. 근거 적음 — 사례 범위에서만.", 3),
  model("chevrolet-malibu", "말리부 차키 분실", "말리부 차키 분실 대구", "말리부", "car-key",
    "말리부 스마트키·폴딩키 분실 제작 사례. 근거 적음 — 사례 범위에서만.", 3),
  model("chevrolet-orlando", "올란도 차키 분실", "올란도 차키 분실 대구", "올란도", "car-key",
    "올란도 차키·리모컨키 분실 제작 사례. 근거 적음 — 사례 범위에서만.", 3),
];

// 지역 — 대구 구 단위는 근거 0~4건이라 만들지 않음. 경산(하양·진량 포함)·영천만.
add.push(
  { slug: "gyeongsan", name: "경산 차키 분실 출장 제작", query: "경산 차키 분실", group: "지역", service: "car-key", minCases: 8, exclude: CAR_EX,
    match: "경산|하양|진량|압량|영남대|대구대",
    angle: "경산(하양·진량·압량·영남대 인근) 출장 사례 모음. 대구 동구에서 출발해 어느 정도 걸리는지는 사례에 나온 표현만. 경산 지역 차종 분포를 사례로." },
  { slug: "yeongcheon", name: "영천 차키 분실 출장 제작", query: "영천 차키 분실", group: "지역", service: "car-key", minCases: 6, exclude: CAR_EX,
    match: "영천",
    angle: "영천 출장 사례 모음. 원거리 출장 시 사전 전화 확인이 필요하다는 점은 일반 안내로." },
);

let n = 0;
for (const t of add) if (!j.topics.some((x) => x.slug === t.slug)) { j.topics.push(t); n++; }
fs.writeFileSync(FILE, JSON.stringify(j, null, 2) + "\n");
console.log(`추가 ${n}개 → 총 ${j.topics.length}개`);
