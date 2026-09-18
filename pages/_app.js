// pages/_app.js
import "../styles/globals.css";
import { Analytics } from "@vercel/analytics/react";
import Head from "next/head";
import Script from "next/script";
import { useEffect } from "react";
import SiteNav from "../components/SiteNav";
import AskWidget from "../components/AskWidget";

// NEXT_PUBLIC_*는 빌드 시점에 인라인됨 — env 변경 시 이 파일이 재컴파일돼야 반영된다
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export default function MyApp({ Component, pageProps }) {
  // 전화/문자 클릭을 GA4 전환 이벤트로 기록 (전 페이지 위임 리스너)
  // PC에서는 tel:/sms: 링크가 전화 앱 없이는 무반응이라 죽은 클릭이 된다 → 번호를 복사하고 안내를 띄운다
  useEffect(() => {
    const isPhone = /Android|iPhone|iPod|Windows Phone|Mobile/i.test(navigator.userAgent) && !/iPad|Tablet/i.test(navigator.userAgent);
    let toastTimer;
    function toast(msg) {
      let el = document.getElementById("contact-toast");
      if (!el) {
        el = document.createElement("div");
        el.id = "contact-toast";
        el.setAttribute("role", "status");
        Object.assign(el.style, {
          position: "fixed", left: "50%", bottom: "calc(120px + env(safe-area-inset-bottom))", transform: "translateX(-50%)",
          background: "#111827", color: "#fff", padding: "10px 16px", borderRadius: "10px", fontSize: "14px", fontWeight: "600",
          boxShadow: "0 8px 24px rgba(15,23,42,0.3)", zIndex: 2000, maxWidth: "calc(100vw - 32px)", textAlign: "center",
        });
        document.body.appendChild(el);
      }
      el.textContent = msg;
      el.style.display = "block";
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { el.style.display = "none"; }, 3500);
    }
    function onClick(e) {
      const a = e.target.closest?.('a[href^="tel:"], a[href^="sms:"]');
      if (!a) return;
      const href = a.getAttribute("href") || "";
      const isSms = href.startsWith("sms:");
      const number = href.replace(/^(tel:|sms:)/, "").split("?")[0];
      if (typeof window.gtag === "function") {
        window.gtag("event", isSms ? "sms_click" : "phone_call_click", {
          event_category: "contact",
          event_label: number,
          page_path: window.location.pathname,
          device: isPhone ? "phone" : "desktop",
        });
      }
      if (!isPhone) {
        e.preventDefault();
        const done = () => toast(`${number} 복사됐습니다 · 휴대폰으로 ${isSms ? "문자" : "전화"} 주세요`);
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(number).then(done, () => toast(`전화 ${number}`));
        else toast(`전화 ${number}`);
      }
    }
    document.addEventListener("click", onClick);
    return () => { document.removeEventListener("click", onClick); clearTimeout(toastTimer); };
  }, []);

  return (
    <>
      <Head>
        {/* 전역 viewport — 개별 페이지 누락 시 모바일이 980px 데스크톱 폭으로 렌더링되는 문제 방지 */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      {GA_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}', { page_path: window.location.pathname });
            `}
          </Script>
        </>
      )}
      <SiteNav />
      <Component {...pageProps} />
      <AskWidget />
      <Analytics />
    </>
  );
}
