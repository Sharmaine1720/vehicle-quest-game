import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { fixture } from "./backend-fixture.js";
const require = createRequire(import.meta.url),
  { chromium } = require("playwright"),
  f = fixture();
const d = f.c.teacherRequest("load").draft;
d.questions = [d.questions[0], d.questions[5], d.questions[10]];
d.settings.hearts = 1;
f.c.teacherRequest("save", d);
f.c.teacherRequest("publish", {
  revision: f.c.teacherRequest("load").draft.revision,
});
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
let failAnswer = true,
  failComplete = true,
  sawRecovery = false;
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.exposeFunction("classCall", (action, payload) => {
    const result = f.c.publicRequest(action, payload);
    if (action === "answer" && failAnswer) {
      failAnswer = false;
      throw Error("Simulated lost answer response");
    }
    if (action === "complete" && failComplete) {
      failComplete = false;
      throw Error("Simulated lost submission response");
    }
    return JSON.parse(JSON.stringify(result));
  });
  await page.addInitScript(() => {
    Math.random = () => 0.4;
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
      body: "export class Backend { request(action,payload){return window.classCall(action,payload);} }",
    }),
  );
  await page.clock.install();
  await page.goto(process.env.TEST_URL || "http://127.0.0.1:8000");
  await page.locator("[name=name]").fill("Class Test");
  await page.locator("[name=grade]").selectOption("4");
  await page.locator("[name=class]").fill("401");
  await page.locator("[name=number]").fill("01");
  await page.locator("#registration button.primary").click();
  await page.locator(".vehicle").first().getByRole("button").click();
  await page.locator("#race-start").click();
  await page.locator("#race").waitFor({ state: "visible" });
  await page.clock.runFor(3000);
  for (let i = 0; i < 3; i++) {
    for (
      let k = 0;
      k < 8 && !(await page.locator("#checkpoint").evaluate((e) => e.open));
      k++
    ) {
      await page.clock.runFor(5000);
      if ((await page.locator("#hearts").textContent()).includes("♡"))
        sawRecovery = true;
    }
    assert.equal(
      await page.locator("#checkpoint").evaluate((e) => e.open),
      true,
    );
    await page
      .locator("#answers button")
      .nth(d.questions[i].correct === "A" ? 0 : 1)
      .click();
    if (i === 0) {
      await page.locator("#retry-answer").waitFor({ state: "visible" });
      await page.locator("#retry-answer").click();
    }
    await page.locator("#continue").waitFor({ state: "visible" });
    await page.clock.runFor(1300);
    await page.locator("#continue").click();
    if (i < 2) {
      await page.locator("#next-level").click();
      await page.clock.runFor(3000);
    }
  }
  await page.locator("#retry").waitFor({ state: "visible" });
  assert.match(
    await page.locator("#submission").textContent(),
    /Not recorded yet/,
  );
  assert.ok(await page.evaluate(() => localStorage.getItem("vq-pending")));
  assert.equal(f.sheets.get("Student Scores").getLastRow(), 2);
  await page.reload();
  await page.locator("#resume-result").click();
  await page.waitForFunction(() =>
    document
      .getElementById("submission")
      .textContent.includes("Recorded in Google Sheets"),
  );
  assert.equal(f.sheets.get("Student Scores").getLastRow(), 2);
  assert.equal(
    await page.evaluate(() => localStorage.getItem("vq-pending")),
    null,
  );
  assert.equal(sawRecovery, true);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: class mode, variable 3-question version, one-heart recovery, lost-answer retry, lost-submission response, reload recovery, exactly one score row",
  );
} finally {
  await browser.close();
}
