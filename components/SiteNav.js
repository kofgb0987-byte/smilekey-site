// components/SiteNav.js — 전 페이지 공통 상단 내비게이션
// 서비스 페이지가 사이트맵에만 있고 내부 링크가 0개라 구글이 크롤하지 않던 문제(고아 페이지) 해소용.
// _app.js에서 전 페이지에 렌더링되므로 모든 글 페이지가 서비스 페이지로 링크를 건다.
import Link from "next/link";
import { useRouter } from "next/router";

const MENU = [
  { href: "/", label: "홈" },
  { href: "/services/car-key", label: "자동차키" },
  { href: "/services/smart-key", label: "스마트키" },
  { href: "/services/door-lock", label: "도어락" },
  { href: "/daegu", label: "대구 소식" },
  { href: "/archive", label: "작업 아카이브" },
];

export default function SiteNav() {
  const { pathname } = useRouter();

  return (
    <nav className="site-nav" aria-label="주요 메뉴">
      {MENU.map(({ href, label }) => {
        const active =
          href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`site-nav-link ${active ? "site-nav-link--active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
