// pages/_app.js
import "../styles/globals.css";
import "../styles/chat.css";
import { Analytics } from "@vercel/analytics/react";
import Script from "next/script";
import { useEffect } from "react";
import ChatWidget from "../components/common/ChatWidget";

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
      <ChatWidget />
    </>
  );
}
