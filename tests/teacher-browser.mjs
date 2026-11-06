import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { fixture } from "./backend-fixture.js";
const require = createRequire(import.meta.url),
  { chromium } = require("playwright");
const { c } = fixture();
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => d.accept());
try {
  await page.exposeFunction("backendCall", (action, payload) =>
    JSON.parse(JSON.stringify(c.teacherRequest(action, payload))),
  );
  await page.goto(process.env.TEST_URL || "http://127.0.0.1:8000");
  await page.evaluate(() => {
    window.google = {
      script: {
        get run() {
          let success, failure;
          const r = {
            withSuccessHandler(fn) {
              success = fn;
              return r;
            },
            withFailureHandler(fn) {
              failure = fn;
              return r;
            },
            teacherRequest(action, payload) {
              window
                .backendCall(action, payload)
                .then((v) => success(v))
                .catch((e) => failure(e));
            },
          };
          return r;
        },
      },
    };
  });
  await page.setContent(
    readFileSync(new URL("../backend/Teacher.html", import.meta.url), "utf8"),
  );
  await page.waitForFunction(() =>
    document.getElementById("status").textContent.includes("loaded"),
  );
  assert.equal(await page.locator("#questions article").count(), 15);
  const version = c.version_().id;
  await page
    .getByRole("button", { name: "＋ Add question", exact: true })
    .click();
  assert.equal(await page.locator("#questions article").count(), 16);
  await page.locator("#save").click();
  await page.waitForFunction(() =>
    document.getElementById("status").textContent.includes("Draft Saved"),
  );
  assert.equal(c.version_().id, version);
  const first = page.locator("#questions article").first();
  await first
    .getByLabel("Question text", { exact: true })
    .fill("A newly edited question!");
  await first.getByRole("button", { name: "Preview", exact: true }).click();
  assert.equal(
    await page.locator("#preview-title").textContent(),
    "A newly edited question!",
  );
  await page
    .getByRole("button", { name: "Close preview", exact: true })
    .click();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lGQAAAAASUVORK5CYII=",
    "base64",
  );
  await first
    .locator("input[type=file]")
    .setInputFiles({ name: "picture.png", mimeType: "image/png", buffer: png });
  await page.waitForFunction(() =>
    document.getElementById("status").textContent.includes("Picture uploaded"),
  );
  assert.ok(
    await page.locator("#questions article").first().locator("img").isVisible(),
  );
  await page.locator("#save").click();
  await page.waitForFunction(() =>
    document.getElementById("status").textContent.includes("Draft Saved"),
  );
  await page.locator("#publish").click();
  await page.waitForFunction(() =>
    document
      .getElementById("status")
      .textContent.includes("published successfully"),
  );
  assert.notEqual(c.version_().id, version);
  assert.equal(c.version_().questions[0].text, "A newly edited question!");
  await page.locator("#history").click();
  await page.locator("#history-dialog").waitFor({ state: "visible" });
  assert.equal(await page.locator("#history-list article").count(), 2);
  await page
    .locator("#history-list article")
    .last()
    .getByRole("button", { name: "Inspect", exact: true })
    .click();
  assert.match(
    await page.locator("#published-text").textContent(),
    /The girl is entering a car/,
  );
  await page.getByRole("button", { name: "Close", exact: true }).last().click();
  await page
    .locator("#history-list article")
    .last()
    .getByRole("button", { name: "RESTORE VERSION", exact: true })
    .click();
  await page.waitForFunction(() =>
    document
      .getElementById("status")
      .textContent.includes("restored as new version"),
  );
  assert.equal(c.teacherRequest("history").length, 3);
  assert.equal(
    c.version_().questions[0].text,
    "The girl is entering a car. What is she doing?",
  );
  assert.deepEqual(errors, []);
  await page.screenshot({ path: "/tmp/vehicle-quest-teacher.png" });
  console.log(
    "PASS: dashboard add/edit/preview/upload, persistent draft, publish, inspect, restore via actual backend functions with Google-service mocks",
  );
} finally {
  await browser.close();
}
