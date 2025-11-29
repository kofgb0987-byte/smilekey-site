// pages/_app.js
import "../styles/globals.css";
import { Analytics } from "@vercel/analytics/react";
import ChatWidget from "../components/chat/ChatWidget";
import "../styles/chat.css";


export default function MyApp({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <Analytics />
     <ChatWidget />
    </>
  );
}
