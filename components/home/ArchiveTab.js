// components/home/ArchiveTab.js
import { useEffect, useMemo, useState } from "react";

export default function ArchiveTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const r = await fetch("/api/summaries");
      const d = await r.json();
      setItems(d.items || []);
      setLoading(false);
    })();
  }, []);

  // ✅ 같은 id가 여러 번 와도 1개만 렌더링(워닝 방지)
  const uniqueItems = useMemo(() => {
    return Array.from(new Map(items.map((it) => [it.id, it])).values());
  }, [items]);

  if (loading) return <section className="card">불러오는 중…</section>;

  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>요약 저장소</h2>

      {uniqueItems.length === 0 ? (
        <p>아직 저장된 요약이 없습니다.</p>
      ) : (
        <ul style={{ paddingLeft: 18 }}>
          {uniqueItems.map((it) => (
            <li key={it.id} style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700 }}>{it.title}</div>
              <div style={{ fontSize: 13, opacity: 0.75, marginTop: 2 }}>
                {it.source} · {it.date}
              </div>

              {it.summary ? (
                <p style={{ marginTop: 6, marginBottom: 6 }}>{it.summary}</p>
              ) : (
                <p style={{ marginTop: 6, marginBottom: 6, opacity: 0.7 }}>
                  (요약 없음)
                </p>
              )}

              <a href={it.link} target="_blank" rel="noreferrer">
                원문 보기
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
