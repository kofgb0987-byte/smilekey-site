// pages/guide/[slug].js — 안내 가이드 본문
// 본문은 content/guide/posts.json(생성기 산출물, 커밋됨). "최근 사례"만 Redis에서 매일(ISR) 갱신.
import Head from "next/head";
import Link from "next/link";
import posts from "../../content/guide/posts.json";
import GuideLinks from "../../components/GuideLinks";
import { getRecentCases, topicBySlug } from "../../lib/guide";

const PHONE = "010-3503-6919";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://smilekey.me";
const SERVICE_LABEL = { "car-key": "자동차키 서비스 안내", "smart-key": "스마트키 서비스 안내", "door-lock": "도어락 서비스 안내" };

export async function getStaticPaths() {
  return { paths: posts.map((p) => ({ params: { slug: p.slug } })), fallback: false };
}

export async function getStaticProps({ params }) {
  const post = posts.find((p) => p.slug === params.slug);
  if (!post) return { notFound: true };
  const topic = topicBySlug(post.slug);
  const recentCases = topic ? await getRecentCases(topic.match, 6) : [];
  // 본문 JSON에서 페이지에 필요 없는 큰 필드는 떼어낸다(evidence·review는 검토용)
  const { evidence, review, ...body } = post;
  return { props: { post: body, recentCases }, revalidate: 86400 };
}

export default function GuidePage({ post, recentCases }) {
  const canonical = `${SITE_URL}/guide/${post.slug}`;
  const desc = `${post.hook || post.title} – 대구 동구 중앙열쇠 실제 작업 기록 기반 안내`.replace(/\s+/g, " ").slice(0, 155);
  const dateIso = post.generated_at || new Date().toISOString();

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: desc,
    url: canonical,
    datePublished: dateIso,
    dateModified: dateIso,
    inLanguage: "ko-KR",
    author: { "@type": "LocalBusiness", name: "중앙열쇠", url: SITE_URL, telephone: PHONE },
    publisher: { "@type": "LocalBusiness", name: "중앙열쇠", url: SITE_URL },
  };
  const faqJsonLd = post.faq && post.faq.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: post.faq.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
      }
    : null;
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "안내 가이드", item: `${SITE_URL}/guide` },
      { "@type": "ListItem", position: 3, name: post.name || post.title, item: canonical },
    ],
  };

  return (
    <>
      <Head>
        <title>{post.title} | 대구 중앙열쇠</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={desc} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="article" />
        <meta property="og:locale" content="ko_KR" />
        <meta property="og:site_name" content="중앙열쇠" />
        <meta property="article:published_time" content={dateIso} />
        <meta property="article:modified_time" content={dateIso} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
        {faqJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />}
      </Head>

      <main className="container">
        <header className="header">
          <div className="header-badge">{post.group ? `${post.group}별 안내` : "안내 가이드"} · 대구 동구 중앙열쇠</div>
          <h1 className="header-title">{post.title}</h1>
          {post.hook ? <p className="header-sub">{post.hook}</p> : null}
        </header>

        <div style={{ marginTop: 8, fontSize: 13 }}>
          <Link href="/guide" style={{ opacity: 0.75 }}>← 안내 가이드 목록</Link>
        </div>

        <section className="card" style={{ marginBottom: "1rem" }}>
          <a href={`tel:${PHONE}`} className="call-button">📞 {PHONE}</a>
          <p className="call-caption">
            차종·연식·차량번호와 차량 위치를 알려주시면 <strong>상담이 빠릅니다.</strong>{" "}
            <a href={`sms:${PHONE}`} style={{ color: "#1e40af", textDecoration: "underline" }}>통화가 어려우면 문자</a>
          </p>
        </section>

        {post.sections.map((s, i) => (
          <section className="card" key={i} style={{ marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.6rem" }}>{s.heading}</h2>
            <p style={{ lineHeight: 1.8, whiteSpace: "pre-line", color: "#333" }}>{s.body}</p>
          </section>
        ))}

        {recentCases && recentCases.length > 0 && (
          <section className="card" style={{ marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.6rem" }}>최근 작업 기록</h2>
            <p style={{ fontSize: "0.85rem", color: "#6b7280", marginBottom: "0.6rem" }}>이 주제에 해당하는 최근 사례입니다. 매일 갱신됩니다.</p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {recentCases.map((c) => (
                <li key={c.id} style={{ padding: "0.5rem 0", borderTop: "1px solid #eee" }}>
                  <Link href={`/archive/${encodeURIComponent(c.id)}`} style={{ color: "#1e40af", fontWeight: 600 }}>{c.title}</Link>
                  {c.date ? <span style={{ color: "#6b7280", fontSize: "0.8rem", marginLeft: 6 }}>{c.date}</span> : null}
                </li>
              ))}
            </ul>
            <p style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>
              <Link href="/archive" style={{ color: "#1e40af" }}>작업 아카이브 전체 보기 →</Link>
            </p>
          </section>
        )}

        {post.faq && post.faq.length > 0 && (
          <section className="card" style={{ marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.75rem" }}>자주 묻는 질문</h2>
            {post.faq.map(({ q, a }, i) => (
              <div key={i} style={{ marginBottom: "0.9rem" }}>
                <p style={{ fontWeight: 600, marginBottom: "0.25rem" }}>Q. {q}</p>
                <p style={{ color: "#555", lineHeight: 1.7 }}>A. {a}</p>
              </div>
            ))}
          </section>
        )}

        {post.service && SERVICE_LABEL[post.service] && (
          <p style={{ textAlign: "center", margin: "0.5rem 0" }}>
            <Link href={`/services/${post.service}`} style={{ color: "#1e40af", textDecoration: "underline" }}>
              {SERVICE_LABEL[post.service]} 보기 →
            </Link>
          </p>
        )}

        <GuideLinks service={post.service} exclude={post.slug} limit={6} title="다른 안내 가이드" />

        <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
          <Link href="/" style={{ color: "#1e40af", textDecoration: "underline", fontSize: "0.9rem" }}>← 중앙열쇠 홈으로</Link>
        </div>
      </main>

      <a href={`tel:${PHONE}`} className="fixed-call-bar">
        <div className="fixed-call-bar-text">📞 중앙열쇠 전화하기</div>
      </a>
    </>
  );
}
