import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { fixture } from "./backend-fixture.js";
const require = createRequire(import.meta.url),
  { chromium } = require("playwright"),
  f = fixture();
// A real, decodable raster; its contents do not matter for the load lifecycle.
const data =
  "iVBORw0KGgoAAAANSUhEUgAAACgAAAAeCAIAAADRv8uKAAAALklEQVR4nO3NMQEAMAgAoLk0xjaTiazg5wMFiKx+F/7JKhaLxWKxWCwWi8XilQFqyAHWNAfXxwAAAABJRU5ErkJggg==";
const uploaded = f.c.teacherRequest("upload", { mime: "image/png", data });
const draft = f.c.teacherRequest("load").draft;
draft.questions = [draft.questions[0], draft.questions[5], draft.questions[10]];
draft.questions.forEach((q) => (q.image = uploaded.id));
const saved = f.c.teacherRequest("save", draft);
f.c.teacherRequest("publish", { revision: saved.revision });
f.metrics.driveReads = 0;
f.metrics.blobReads = 0;
f.metrics.driveWhileLocked = 0;
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let release,
  firstImage = true,
  startDriveReads;
const imageGate = new Promise((resolve) => (release = resolve));
try {
  await page.exposeFunction("classCall", async (action, payload) => {
    if (action === "image" && firstImage) {
      firstImage = false;
      await imageGate;
      throw Error("Simulated picture download failure");
    }
    const response = f.c.publicRequest(action, payload);
    if (action === "start") startDriveReads = f.metrics.driveReads;
    return JSON.parse(JSON.stringify(response));
  });
  await page.route("**/config.js", (r) =>
    r.fulfill({
      contentType: "application/javascript",
      body: "window.VEHICLE_QUEST_CONFIG={studentApiUrl:'https://example.invalid/api',teacherUrl:'',musicTracks:[]};",
    }),
  );
  await page.route("**/js/api.js", (r) =>
    r.fulfill({
      contentType: "application/javascript",
      body: "export class Backend {request(action,payload){return window.classCall(action,payload);}}",
    }),
  );
  await page.clock.install();
  await page.goto(process.env.TEST_URL || "http://127.0.0.1:8000");
  await page.locator("[name=name]").fill("Picture Test");
  await page.locator("[name=grade]").selectOption("4");
  await page.locator("[name=class]").fill("401");
  await page.locator("[name=number]").fill("01");
  await page.locator("#registration button.primary").click();
  await page.locator(".vehicle").first().getByRole("button").click();
  await page.locator("#race-start").click();
  await page.locator("#race").waitFor({ state: "visible" });
  assert.equal(startDriveReads, 0);
  assert.equal(f.metrics.blobReads, 0);
  await page.clock.runFor(3000);
  for (
    let k = 0;
    k < 8 && !(await page.locator("#checkpoint").evaluate((e) => e.open));
    k++
  )
    await page.clock.runFor(3000);
  assert.equal(await page.locator("#checkpoint").evaluate((e) => e.open), true);
  assert.equal(await page.locator("#answers button:disabled").count(), 2);
  assert.match(await page.locator("#picture-status").textContent(), /Loading/);
  release();
  await page.locator("#retry-picture").waitFor({ state: "visible" });
  assert.equal(await page.locator("#answers button:disabled").count(), 2);
  await page.locator("#retry-picture").click();
  await page.waitForFunction(
    () => document.querySelectorAll("#answers button:disabled").length === 0,
  );
  assert.equal(await page.locator("#question-image").isVisible(), true);
  assert.ok(
    await page
      .locator("#question-image")
      .evaluate((image) => image.naturalWidth > 0),
  );
  await page.locator("#answers button").first().click();
  await page.locator("#continue").waitFor({ state: "visible" });
  await page.clock.runFor(1300);
  await page.locator("#continue").click();
  await page.locator("#next-level").click();
  await page.clock.runFor(3000);
  for (
    let k = 0;
    k < 8 && !(await page.locator("#checkpoint").evaluate((e) => e.open));
    k++
  )
    await page.clock.runFor(3000);
  await page.waitForFunction(
    () => document.querySelectorAll("#answers button:disabled").length === 0,
  );
  assert.equal(await page.locator("#question-image").isVisible(), true);
  assert.equal(f.metrics.blobReads, 1, "Shared picture must be fetched once");
  assert.equal(f.metrics.driveWhileLocked, 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: race starts before pictures download; picture-only questions wait safely; failed picture retries; repeated image is reused without another Drive download",
  );
} finally {
  await browser.close();
}
