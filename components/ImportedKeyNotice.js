// components/ImportedKeyNotice.js — 수입차 키 "미리 복사해 두세요" 안내 + 기존 키 없이는 복사가 안 되는 차종 등록부
//   문구·차종은 content/guide/facts.json(importedKey)·models.json(noCopyWithoutKey)에서 읽는다.
//   같은 데이터를 llms.txt와 상담 워커(scripts/ask-worker.mjs)도 쓰므로, 사실이 바뀌면 JSON만 고치면 된다.
//   표시 위치: 수입차 주제 가이드(topics.json imported=true)·예비키 가이드·/services/smart-key
import facts from "../content/guide/facts.json";
import models from "../content/guide/models.json";

const PHONE = "010-3503-6919";

/** 사장님 확인이 끝난 "기존 키 없이는 복사 불가" 차종 목록 (brand를 주면 그 브랜드만) */
export function noCopyModels(brand) {
  const list = (models.noCopyWithoutKey || []).filter((m) => m.confirmed !== false);
  return brand ? list.filter((m) => m.brand === brand) : list;
}

export const modelLabel = (m) => `${m.brand} ${m.model}${m.years ? ` (${m.years})` : ""}`;

export default function ImportedKeyNotice({ style }) {
  const fact = facts.importedKey;
  if (!fact || fact.confirmed === false || !fact.text) return null;
  const list = noCopyModels();

  return (
    <section className="card" style={{ marginBottom: "1rem", borderLeft: "4px solid #f59e0b", ...style }}>
      <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.6rem" }}>수입차 키는 키가 있을 때 미리 복사해 두세요</h2>
      <p style={{ lineHeight: 1.8, color: "#333" }}>{fact.text}</p>

      {list.length > 0 && (
        <>
          <p style={{ marginTop: "0.8rem", marginBottom: "0.3rem", fontWeight: 600 }}>기존 키가 없으면 복사가 안 되는 차종 (확인된 것)</p>
          <ul style={{ paddingLeft: "1.2rem", lineHeight: 1.9, margin: 0, color: "#333" }}>
            {list.map((m) => (
              <li key={`${m.brand}-${m.model}`}>
                <strong>{modelLabel(m)}</strong>
                {m.note ? <span style={{ color: "#555" }}> – {m.note}</span> : null}
              </li>
            ))}
          </ul>
          <p style={{ marginTop: "0.6rem", lineHeight: 1.7, color: "#555", fontSize: "0.95rem" }}>
            이런 차종은 키를 전부 잃어버리면 현장 제작이 어려워 제조사 서비스센터를 거쳐야 합니다. 키가 한 개뿐이라면{" "}
            <a href={`tel:${PHONE}`} style={{ color: "#1e40af", textDecoration: "underline" }}>전화</a>로 예비키 복사를 먼저 문의해 주세요.
          </p>
        </>
      )}
    </section>
  );
}
