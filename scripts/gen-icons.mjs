// Renders public/icons/icon.svg to the PNG sizes the manifest and iOS need.
// Usage: node scripts/gen-icons.mjs   (set PLAYWRIGHT_CHROMIUM_PATH to use a local Chromium)
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const svg = readFileSync("public/icons/icon.svg", "utf8");
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
);
const page = await browser.newPage();

// "any" icons use the rounded square; "maskable" fills the canvas and keeps the
// figure inside the 80% safe zone (Android crops it into its own shape).
const variants = [
  { file: "icon-192.png", size: 192, maskable: false },
  { file: "icon-512.png", size: 512, maskable: false },
  { file: "maskable-512.png", size: 512, maskable: true },
  { file: "apple-touch-icon.png", size: 180, maskable: true },
];
for (const { file, size, maskable } of variants) {
  const inner = maskable ? svg.replace('rx="112"', 'rx="0"').replace("<g ", '<g transform="translate(51 51) scale(0.8)" ') : svg;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${inner.replace(
      '<circle cx="256"',
      maskable ? '<circle transform="translate(51 51) scale(0.8)" cx="256"' : '<circle cx="256"',
    )}`,
  );
  await page.screenshot({ path: `public/icons/${file}`, omitBackground: true });
  console.log("wrote", file);
}
await browser.close();
