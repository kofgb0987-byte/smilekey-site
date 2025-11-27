// pages/_app.js
import "../styles/globals.css";
import { Analytics } from "@vercel/analytics/react" // or /next

export default function MyApp({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
