// Convert baked sprite sheets (public/sprites/*.png) to WebP with alpha, via
// headless Chromium's encoder, and point the manifest at the .webp files.
// Run after art/bake_sprites.py: node art/sprites-webp.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
const dir = path.resolve("public/sprites");
const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json")));
const browser = await chromium.launch();
const page = await browser.newPage();
for (const entry of Object.values(manifest)) {
  if (!entry.file.endsWith(".png")) continue;
  const png = fs.readFileSync(path.join(dir, entry.file)).toString("base64");
  const webp = await page.evaluate(async (data) => {
    const img = new Image();
    img.src = "data:image/png;base64," + data;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    c.getContext("2d").drawImage(img, 0, 0);
    return c.toDataURL("image/webp", 0.9).split(",")[1];
  }, png);
  const file = entry.file.replace(/\.png$/, ".webp");
  fs.writeFileSync(path.join(dir, file), Buffer.from(webp, "base64"));
  fs.unlinkSync(path.join(dir, entry.file));
  entry.file = file;
}
await browser.close();
fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 1) + "\n");
console.log("webp", Object.keys(manifest).length);
