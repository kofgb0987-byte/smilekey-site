// pages/_app.js
import "../styles/globals.css";
import { Analytics } from "@vercel/analytics/react";
import Head from "next/head";
import Script from "next/script";
import { useEffect } from "react";

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export default function MyApp({ Component, pageProps }) {
  // 전화/문자 클릭을 GA4 전환 이벤트로 기록 (전 페이지 위임 리스너)
  useEffect(() => {
    function onClick(e) {
      const a = e.target.closest?.('a[href^="tel:"], a[href^="sms:"]');
      if (!a) return;
      const href = a.getAttribute("href") || "";
      const isSms = href.startsWith("sms:");
      if (typeof window.gtag === "function") {
        window.gtag("event", isSms ? "sms_click" : "phone_call_click", {
          event_category: "contact",
          event_label: href.replace(/^(tel:|sms:)/, ""),
          page_path: window.location.pathname,
        });
      }
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
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
      <Component {...pageProps} />
      <Analytics />
    </>
  );
}
