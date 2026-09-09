// components/GuideLinks.js — 안내 가이드 링크 묶음 (서비스 페이지 하단·가이드 본문 하단 공용)
// index.json은 생성기(scripts/guide-write.mjs)가 만든 목록이라 실제 존재하는 페이지만 링크된다.
import Link from "next/link";
import guideIndex from "../content/guide/index.json";

export default function GuideLinks({ service, exclude, limit = 8, title = "관련 안내 가이드" }) {
  let items = guideIndex.filter((g) => g.slug !== exclude);
  if (service) {
    // 같은 서비스 가이드를 앞에, 나머지를 뒤에 — 서비스 페이지에서 링크 0개가 되지 않게
    const same = items.filter((g) => g.service === service);
    const rest = items.filter((g) => g.service !== service);
    items = [...same, ...rest];
  }
  items = items.slice(0, limit);
  if (!items.length) return null;

  return (
    <section className="card" style={{ marginTop: "1rem" }}>
      <h2 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "0.6rem" }}>{title}</h2>
      <ul style={{ paddingLeft: "1.1rem", lineHeight: 1.9, margin: 0 }}>
        {items.map((g) => (
          <li key={g.slug}>
            <Link href={`/guide/${g.slug}`} style={{ color: "#1e40af", textDecoration: "underline" }}>
              {g.name}
            </Link>
            {g.evidence_hits ? (
              <span style={{ color: "#6b7280", fontSize: "0.85rem" }}> · 사례 {g.evidence_hits}건</span>
            ) : null}
          </li>
        ))}
      </ul>
      <p style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>
        <Link href="/guide" style={{ color: "#1e40af" }}>전체 안내 가이드 보기 →</Link>
      </p>
    </section>
  );
}
