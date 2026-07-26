// pages/daegu/[id].js — 대구 소식 상세
import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import { listDaeguIds, getDaeguPost } from "../../lib/redis";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://smilekey.me";
const PHONE = "010-3503-6919";

// 랜덤 닉네임 — 대구 감성 (수식어 + 명소/음식, 20자 제한 안쪽)
const NICK_ADJ = [
  "느긋한", "신난", "배고픈", "수줍은", "당당한", "촉촉한",
  "시원한", "포근한", "야무진", "심각한", "해맑은", "궁금한",
];
const NICK_NOUN = [
  "수성못 오리배", "팔공산 다람쥐", "대프리카 생존자", "동성로 멋쟁이",
  "서문시장 단골", "금호강 수달", "앞산 등산러", "납작만두 러버",
  "막창 미식가", "김광석길 산책러", "이월드 관람차", "대구 사과",
  "칠성시장 손님", "83타워 전망러", "치맥 감별사",
];
function randomNick() {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  return `${pick(NICK_ADJ)} ${pick(NICK_NOUN)}`.slice(0, 20);
}
// 🔒 품질 검증 기간 동안 noindex 유지 (index.js와 함께 전환)
const INDEXABLE = false;

export async function getStaticPaths() {
  try {
    const ids = await listDaeguIds(30);
    return { paths: ids.map((id) => ({ params: { id } })), fallback: "blocking" };
  } catch {
    return { paths: [], fallback: "blocking" };
  }
}

export async function getStaticProps({ params }) {
  try {
    const item = await getDaeguPost(params.id);
    if (!item || !item.title) return { notFound: true };
    return { props: { item: { ...item, id: params.id } }, revalidate: 3600 };
  } catch {
    return { notFound: true };
  }
}

export default function DaeguDetail({ item }) {
  const [views, setViews] = useState(null);
  const [likes, setLikes] = useState(null);
  const [liked, setLiked] = useState(false);
  const [shareMsg, setShareMsg] = useState("");
  const [comments, setComments] = useState([]);
  const [commentTotal, setCommentTotal] = useState(0);
  const [cName, setCName] = useState("");
  const [cText, setCText] = useState("");
  const [cBusy, setCBusy] = useState(false);
  const [cMsg, setCMsg] = useState("");

  // 좋아요 초기값 + 내가 눌렀는지
  useEffect(() => {
    try {
      setLiked(!!localStorage.getItem(`daegu-liked-${item.id}`));
    } catch {}
    fetch(`/api/daegu/like?id=${encodeURIComponent(item.id)}`)
      .then((r) => r.json())
      .then((d) => d?.ok && setLikes(d.likes))
      .catch(() => {});
  }, [item.id]);

  // 닉네임: 저장된 게 있으면 재사용, 없으면 랜덤 추천
  useEffect(() => {
    let saved = "";
    try {
      saved = localStorage.getItem("daegu-nickname") || "";
    } catch {}
    setCName(saved || randomNick());
  }, []);

  // 댓글 로드
  useEffect(() => {
    fetch(`/api/daegu/comments?id=${encodeURIComponent(item.id)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok) {
          setComments(d.items);
          setCommentTotal(d.total);
        }
      })
      .catch(() => {});
  }, [item.id]);

  async function toggleLike() {
    const action = liked ? "unlike" : "like";
    setLiked(!liked); // 낙관적 반영
    try {
      if (liked) localStorage.removeItem(`daegu-liked-${item.id}`);
      else localStorage.setItem(`daegu-liked-${item.id}`, "1");
    } catch {}
    try {
      const r = await fetch(`/api/daegu/like?id=${encodeURIComponent(item.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const d = await r.json();
      if (d?.ok) setLikes(d.likes);
    } catch {}
  }

  async function sharePost() {
    const url = `${SITE_URL}/daegu/${encodeURIComponent(item.id)}`;
    let done = false;
    if (navigator.share) {
      try {
        await navigator.share({ title: item.title, url });
        done = true;
      } catch {} // 사용자가 공유창을 닫은 경우 등
    }
    if (!done) {
      try {
        await navigator.clipboard.writeText(url);
        setShareMsg("링크가 복사됐어요!");
        setTimeout(() => setShareMsg(""), 2500);
        done = true;
      } catch {
        setShareMsg(url);
      }
    }
    if (done) {
      fetch(`/api/daegu/share?id=${encodeURIComponent(item.id)}`, { method: "POST" }).catch(() => {});
    }
  }

  async function submitComment(e) {
    e.preventDefault();
    if (!cText.trim() || cBusy) return;
    setCBusy(true);
    setCMsg("");
    try {
      const r = await fetch(`/api/daegu/comments?id=${encodeURIComponent(item.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cName, text: cText }),
      });
      const d = await r.json();
      if (d?.ok && d.comment) {
        setComments([d.comment, ...comments]);
        setCommentTotal(commentTotal + 1);
        setCText("");
        setCMsg("등록됐어요!");
        try {
          localStorage.setItem("daegu-nickname", cName); // 다음에도 같은 닉네임
        } catch {}
      } else {
        setCMsg(d?.error || "등록에 실패했어요. 잠시 후 다시 시도해 주세요.");
      }
    } catch {
      setCMsg("등록에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setCBusy(false);
      setTimeout(() => setCMsg(""), 3000);
    }
  }

  // 조회수: 세션 최초 1회만 +1, 재방문은 읽기만
  useEffect(() => {
    const key = `daegu-viewed-${item.id}`;
    let seen = false;
    try {
      seen = !!sessionStorage.getItem(key);
    } catch {}
    fetch(`/api/daegu/view?id=${encodeURIComponent(item.id)}`, {
      method: seen ? "GET" : "POST",
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok) setViews(d.views);
        try {
          sessionStorage.setItem(key, "1");
        } catch {}
      })
      .catch(() => {});
  }, [item.id]);

  const canonical = `${SITE_URL}/daegu/${encodeURIComponent(item.id)}`;
  const desc = (item.hook || item.title).slice(0, 155);
  const sections = Array.isArray(item.sections) ? item.sections : [];
  const tags = Array.isArray(item.tags) ? item.tags : [];
  const sources = Array.isArray(item.sources) ? item.sources : [];
  const images = Array.isArray(item.images) ? item.images : [];
  const ogImage = item.thumbnail
    ? item.thumbnail.startsWith("http")
      ? item.thumbnail
      : `${SITE_URL}${item.thumbnail}`
    : null;

  return (
    <>
      <Head>
        <title>{`${item.title} | 대구 소식`}</title>
        <meta name="description" content={desc} />
        {!INDEXABLE && <meta name="robots" content="noindex,follow" />}
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={item.title} />
        <meta property="og:description" content={desc} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="article" />
        {ogImage && <meta property="og:image" content={ogImage} />}
      </Head>

      <main className="container">
        <div style={{ margin: "12px 0", display: "flex", gap: 14 }}>
          <Link href="/daegu" style={{ fontSize: 13, opacity: 0.75 }}>
            ← 대구 소식
          </Link>
          <Link href="/" style={{ fontSize: 13, opacity: 0.75 }}>
            홈
          </Link>
        </div>

        <article className="card">
          <h1 style={{ marginTop: 0, fontSize: 22, lineHeight: 1.35 }}>{item.title}</h1>
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 14 }}>
            {item.date}
            {views !== null ? ` · 조회 ${views}` : ""}
          </div>

          {item.hook ? (
            <p style={{ fontSize: 15, fontWeight: 500, opacity: 0.9 }}>{item.hook}</p>
          ) : null}

          {images.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt={`${item.title} 관련 이미지 ${i + 1}`}
              loading="lazy"
              style={{
                display: "block",
                maxWidth: "100%",
                borderRadius: 10,
                marginTop: i === 0 ? 12 : 10,
              }}
            />
          ))}

          {sections.map((s, i) => (
            <section key={i} style={{ marginTop: 18 }}>
              <h2 style={{ fontSize: 17, marginBottom: 6 }}>{s.heading}</h2>
              <p style={{ margin: 0, lineHeight: 1.7 }}>{s.body}</p>
            </section>
          ))}

          {tags.length ? (
            <div style={{ marginTop: 18, fontSize: 13, opacity: 0.7 }}>
              {tags.map((t) => `#${t}`).join(" ")}
            </div>
          ) : null}

          <div style={{ marginTop: 18, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={toggleLike}
              style={{
                padding: "8px 16px",
                borderRadius: 999,
                border: liked ? "1.5px solid #dc2626" : "1.5px solid rgba(0,0,0,0.2)",
                background: liked ? "#fef2f2" : "transparent",
                color: liked ? "#dc2626" : "inherit",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              {liked ? "♥" : "♡"} 좋아요{likes !== null ? ` ${likes}` : ""}
            </button>
            <button
              type="button"
              onClick={sharePost}
              style={{
                padding: "8px 16px",
                borderRadius: 999,
                border: "1.5px solid rgba(0,0,0,0.2)",
                background: "transparent",
                color: "inherit",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              🔗 공유하기
            </button>
            {shareMsg && (
              <span style={{ fontSize: 13, opacity: 0.75, overflowWrap: "anywhere" }}>{shareMsg}</span>
            )}
          </div>

          {sources.length ? (
            <div style={{ marginTop: 18, paddingTop: 12, borderTop: "1px solid rgba(0,0,0,0.08)" }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>참고한 소식</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                {sources.map((s, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    {String(s.link || "").startsWith("http") ? (
                      <a href={s.link} target="_blank" rel="noreferrer nofollow">
                        {s.title}
                      </a>
                    ) : (
                      <span>{s.title} (한국관광공사 행사데이터)</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div
            style={{
              marginTop: 22,
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(0,0,0,0.04)",
              fontSize: 13,
              opacity: 0.85,
            }}
          >
            대구 소식은 동구 검사동 <strong>중앙열쇠</strong>가 전해드려요. 자동차키·스마트키·도어락
            문의 <a href={`tel:${PHONE}`}>{PHONE}</a>
          </div>
        </article>

        <section className="card" style={{ marginTop: 14 }}>
          <h2 style={{ marginTop: 0, fontSize: 17 }}>💬 댓글 {commentTotal > 0 ? commentTotal : ""}</h2>

          <form onSubmit={submitComment} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
              <input
                type="text"
                value={cName}
                onChange={(e) => setCName(e.target.value)}
                placeholder="닉네임"
                maxLength={20}
                style={{
                  flex: "1 1 auto",
                  minWidth: 0,
                  maxWidth: 220,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(0,0,0,0.2)",
                  fontSize: 16, // 16px 미만이면 iOS가 포커스 시 화면을 확대함
                }}
              />
              <button
                type="button"
                onClick={() => setCName(randomNick())}
                title="닉네임 다시 뽑기"
                aria-label="닉네임 다시 뽑기"
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(0,0,0,0.2)",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 15,
                  flexShrink: 0,
                }}
              >
                🎲
              </button>
              {/* 봇 함정 필드 — 사람에겐 안 보임 */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                style={{ position: "absolute", left: -9999, width: 1, height: 1 }}
                aria-hidden="true"
              />
            </div>
            <textarea
              value={cText}
              onChange={(e) => setCText(e.target.value)}
              placeholder="댓글을 남겨보세요 (500자 이내)"
              maxLength={500}
              rows={3}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.2)",
                fontSize: 16, // 16px 미만이면 iOS가 포커스 시 화면을 확대함
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
              <button
                type="submit"
                disabled={cBusy || !cText.trim()}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: "none",
                  background: cText.trim() ? "#1e40af" : "rgba(0,0,0,0.15)",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: cText.trim() ? "pointer" : "default",
                  fontSize: 14,
                }}
              >
                {cBusy ? "등록 중…" : "등록"}
              </button>
              {cMsg && <span style={{ fontSize: 13, opacity: 0.75 }}>{cMsg}</span>}
            </div>
          </form>

          {comments.length === 0 ? (
            <p style={{ fontSize: 14, opacity: 0.6, margin: 0 }}>첫 댓글을 남겨보세요!</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {comments.map((c) => (
                <li
                  key={c.cid}
                  style={{ padding: "10px 0", borderTop: "1px solid rgba(0,0,0,0.07)" }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    {c.name || "익명"}
                    <span style={{ fontWeight: 400, opacity: 0.55, marginLeft: 8, fontSize: 12 }}>
                      {String(c.ts || "").slice(0, 10)}
                    </span>
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 14,
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {c.text}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
