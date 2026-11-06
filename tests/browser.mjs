import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const bank = JSON.parse(
  readFileSync(new URL("../data/questions.json", import.meta.url)),
);
const base = process.env.TEST_URL || "http://127.0.0.1:8000";
const errors = [];
const context = await browser.newContext({
  viewport: { width: 1180, height: 820 },
  hasTouch: true,
});
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
async function register(grade = 4) {
  await page.locator("[name=name]").fill("Test Explorer");
  await page.locator("[name=grade]").selectOption(String(grade));
  await page.locator("[name=class]").fill(grade + "01");
  await page.locator("[name=number]").fill("01");
  await page
    .locator("#registration button[type=submit],#registration button.primary")
    .click();
}
async function advanceToQuestion() {
  for (let n = 0; n < 6; n++) {
    if (await page.locator("#checkpoint").evaluate((e) => e.open)) return;
    await page.clock.runFor(5000);
  }
  throw Error("Checkpoint did not appear");
}
try {
  await page.clock.install();
  await page.goto(base);
  await page.screenshot({ path: "/tmp/vehicle-quest-welcome.png" });
  await register(4);
  assert.equal(await page.locator(".vehicle").count(), 5);
  await page.locator(".vehicle").first().getByRole("button").click();
  await page.locator("#race-start").click();
  await page.locator("#race").waitFor({ state: "visible" });
  await page.clock.runFor(3000);
  const carCenter = () =>
    page.locator("#track").evaluate((c) => {
      const p = c.getContext("2d").getImageData(0, 400, 1100, 180).data;
      let sum = 0,
        count = 0;
      for (let i = 0; i < p.length; i += 4)
        if (p[i] > 180 && p[i + 1] < 80 && p[i + 2] < 100) {
          sum += (i / 4) % 1100;
          count++;
        }
      return sum / count;
    });
  const before = await carCenter();
  const left = await page.locator("#left").boundingBox();
  await page.mouse.move(left.x + left.width / 2, left.y + left.height / 2);
  await page.mouse.down();
  await page.clock.runFor(400);
  await page.mouse.up();
  assert.ok(
    (await carCenter()) < before - 70,
    "Holding left must move the rendered car left",
  );
  await page.screenshot({ path: "/tmp/vehicle-quest-race.png" });
  await page.locator("#pause").click();
  assert.match(await page.locator("#race-message").textContent(), /breath/);
  await page.clock.runFor(1000);
  assert.equal(
    await page.locator("#checkpoint").evaluate((e) => e.open),
    false,
  );
  await page.locator("#pause").click();
  await page.keyboard.down("ArrowLeft");
  await page.clock.runFor(500);
  await page.keyboard.up("ArrowLeft");
  for (let i = 0; i < 15; i++) {
    await advanceToQuestion();
    assert.match(
      await page.locator("#question-label").textContent(),
      new RegExp("CHECKPOINT " + (i + 1) + " OF 15"),
    );
    const correct = bank[i].correct,
      chosen = i === 0 ? (correct === "A" ? "B" : "A") : correct;
    await page
      .locator("#answers button")
      .nth(chosen === "A" ? 0 : 1)
      .click();
    assert.match(
      await page.locator("#feedback").textContent(),
      i === 0 ? /Good try/ : /Brilliant/,
    );
    assert.equal(await page.locator("#answers button:disabled").count(), 2);
    await page.clock.runFor(1300);
    await page.locator("#continue").click();
    if (i === 4 || i === 9) {
      assert.equal(
        await page.locator("#transition").evaluate((e) => e.open),
        true,
      );
      await page.locator("#next-level").click();
      await page.clock.runFor(3000);
    }
  }
  assert.equal(await page.locator("#results").isVisible(), true);
  assert.match(await page.locator("#final-score").textContent(), /93.33/);
  assert.match(
    await page.locator("#submission").textContent(),
    /not been sent/,
  );
  await page.screenshot({ path: "/tmp/vehicle-quest-results.png" });
  console.log(
    "PASS: full 15-question race, 3 levels, mixed answers, pause, keyboard, correct score, no false submission",
  );
  await page.goto(base);
  await page.setViewportSize({ width: 768, height: 1024 });
  await register(6);
  await page.screenshot({ path: "/tmp/vehicle-quest-ipad.png" });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  console.log("PASS: iPad portrait registration and vehicle selection layout");
  await page.goto(base);
  await page.locator("[name=name]").fill("Test");
  await page.locator("[name=grade]").selectOption("5");
  await page.locator("[name=class]").fill("401");
  await page.locator("[name=number]").fill("01");
  await page.locator("#registration button.primary").click();
  assert.match(
    await page.locator("#registration-error").textContent(),
    /match/,
  );
  console.log("PASS: mismatched class registration blocked");
  await page.route("**/assets/vehicles/*.png", (r) => r.abort());
  await page.goto(base);
  await register(5);
  await page.locator(".vehicle").first().getByRole("button").click();
  await page.locator("#race-start").click();
  await page.locator("#race").waitFor({ state: "visible" });
  await page.clock.runFor(3000);
  await advanceToQuestion();
  console.log(
    "PASS: missing vehicle artwork still permits racing and questions",
  );
  await page.unroute("**/assets/vehicles/*.png");
  assert.deepEqual(errors, []);
  console.log("PASS: no browser JavaScript errors");
} finally {
  await browser.close();
}
