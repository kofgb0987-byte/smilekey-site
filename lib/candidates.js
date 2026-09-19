// lib/candidates.js — 대구 소식 후보의 날짜·소스 분류·균형 선발 (의존성 없는 순수 함수)
//
// 09-19 '금호강 한마음 축제' 누락 원인 두 가지를 여기서 고친다.
//   1) 날짜가 UTC 일자였음 — 블로그 postdate를 KST 자정으로 만든 뒤 UTC로 잘라 "어제"가 됨.
//      구글 뉴스 pubDate(GMT)도 KST 기준으로 자르지 않아 저녁 기사가 전날로 밀렸다.
//   2) 후보를 최신순 slice(0, 40)로 잘랐음 — 날짜가 일 단위라 "오늘 뉴스"가 40건을 넘는 날엔
//      블로그·관광공사 공식 행사·전날 예고 기사가 구조적으로 모델 앞에 도달하지 못했다.

// Date → KST 기준 "YYYY-MM-DD"
export function kstDay(d) {
  return new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// 후보 소스 구분 — 수집현황 로그와 균형 선발이 같은 기준을 쓴다
export function candidateSource(c) {
  if ((c.link || "").includes("news.google.com")) return "gnews";
  if (c.type === "official") return "official";
  if (c.type === "blog") return "blog";
  return "naver";
}

export function sourceMixOf(list) {
  const mix = {};
  for (const c of list) {
    const s = candidateSource(c);
    mix[s] = (mix[s] || 0) + 1;
  }
  return mix;
}

// 큐 배열을 번갈아 가며 앞에서 하나씩 뽑는다. 비는 큐는 건너뛰므로 한 소스가 적으면 나머지가 채운다.
function roundRobin(queues, max) {
  const out = [];
  const qs = queues.map((q) => [...q]);
  let i = 0;
  while (out.length < max && qs.some((q) => q.length)) {
    const q = qs[i % qs.length];
    if (q.length) out.push(q.shift());
    i++;
  }
  return out;
}

// 소스별 → 쿼리별 2단 라운드로빈 선발.
// 입력은 최신순 정렬 상태를 전제하며 같은 소스·쿼리 안에서는 그 순서를 유지한다.
// 쿼리 단계까지 섞는 이유: 네이버 뉴스 몫 10건을 첫 쿼리("대구 축제") 오늘 기사가 독식하지 않게.
export function pickBalancedCandidates(cands, max) {
  const bySource = new Map();
  for (const c of cands) {
    const s = candidateSource(c);
    if (!bySource.has(s)) bySource.set(s, new Map());
    const byQuery = bySource.get(s);
    const q = c.query || "";
    if (!byQuery.has(q)) byQuery.set(q, []);
    byQuery.get(q).push(c);
  }
  const perSource = [...bySource.values()].map((byQuery) =>
    roundRobin([...byQuery.values()], Infinity)
  );
  return roundRobin(perSource, max);
}
