#!/usr/bin/env node
// scripts/indexnow-ping.mjs — 가이드 URL 전체를 IndexNow로 통지 (배포 후 1회 실행)
//   node scripts/indexnow-ping.mjs [추가URL...]
// lib/indexnow.js와 같은 키·엔드포인트. 키 파일은 public/{KEY}.txt로 이미 호스팅됨.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const KEY = "7f9e9f31179a2c39e75c4f999d110792";
const HOST = "smilekey.me";
const ENDPOINTS = ["https://searchadvisor.naver.com/indexnow", "https://api.indexnow.org/indexnow"];

const index = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "guide", "index.json"), "utf8"));
const urls = [
  `https://${HOST}/guide`,
  ...index.map((g) => `https://${HOST}/guide/${g.slug}`),
  ...process.argv.slice(2),
];
console.log(`통지 URL ${urls.length}개`);
for (const ep of ENDPOINTS) {
  try {
    const r = await fetch(ep, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls }),
    });
    console.log(`${ep} → ${r.status}`);
  } catch (e) {
    console.log(`${ep} → 실패 ${e.message}`);
  }
}
