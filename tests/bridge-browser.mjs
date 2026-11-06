import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url),
  { chromium } = require("playwright");
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage(),
  base = process.env.TEST_URL || "http://127.0.0.1:8000";
try {
  await page.route("https://script.google.com/**", (r) => {
    const url = new URL(r.request().url());
    return r.fulfill({
      contentType: "text/html",
      body:
        '<iframe src="https://n-test-script.googleusercontent.com/bridge?' +
        url.searchParams.toString() +
        '"></iframe>',
    });
  });
  await page.route("https://n-test-script.googleusercontent.com/**", (r) => {
    const url = new URL(r.request().url());
    let html = readFileSync(
      new URL("../backend/Bridge.html", import.meta.url),
      "utf8",
    )
      .replace(
        "<?!= JSON.stringify(origin) ?>",
        JSON.stringify(url.searchParams.get("origin")),
      )
      .replace(
        "<?!= JSON.stringify(channel) ?>",
        JSON.stringify(url.searchParams.get("channel")),
      );
    html = html.replace(
      "<script>",
      `<script>window.google={script:{get run(){let success,failure;const run={withSuccessHandler(fn){success=fn;return run},withFailureHandler(fn){failure=fn;return run},publicRequest(action,payload){if(action==='answer')failure({message:'Simulated backend rejection'});else success({action,payload});}};return run;}}};</script><script>`,
    );
    return r.fulfill({ contentType: "text/html", body: html });
  });
  await page.goto(base);
  const r = await page.evaluate(async () => {
    const { Backend } = await import("./js/api.js");
    window.testBackend = new Backend(
      "https://script.google.com/macros/s/test/exec",
    );
    return window.testBackend.request("start", { test: "nested-frame" });
  });
  assert.equal(r.payload.test, "nested-frame");
  assert.equal(r.action, "start");
  const error = await page.evaluate(async () => {
    try {
      await window.testBackend.request("answer", {});
    } catch (e) {
      return e.message;
    }
  });
  assert.equal(error, "Simulated backend rejection");
  console.log(
    "PASS: real cross-origin nested iframe handshake, nonce-bound transport, and backend error propagation using routed Google-origin substitutes",
  );
} finally {
  await browser.close();
}
