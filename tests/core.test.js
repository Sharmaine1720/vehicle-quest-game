import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  validateStudent,
  validateBank,
  score,
  collision,
  VEHICLES,
} from "../js/core.js";
const bank = JSON.parse(
  readFileSync(new URL("../data/questions.json", import.meta.url)),
);
test("registration accepts grades 4–6, class formats, and leading zero numbers", () => {
  for (const grade of [4, 5, 6]) {
    const s = { name: "Amy", grade, class: grade + "01", number: "01" };
    assert.equal(validateStudent(s), "");
    assert.equal(s.number, "01");
    assert.equal(validateStudent({ ...s, class: "Grade " + grade + " A" }), "");
    assert.notEqual(
      validateStudent({ ...s, class: grade === 4 ? "501" : "401" }),
      "",
    );
  }
  assert.notEqual(
    validateStudent({ name: "Amy", grade: 3, class: "301", number: "01" }),
    "",
  );
  assert.notEqual(
    validateStudent({ name: "", grade: 4, class: "401", number: "01" }),
    "",
  );
});
// Fixed examples test the engine independently of the teacher-editable lesson.
const sample = Array.from({ length: 15 }, (_, i) => ({
  id: `sample-${i + 1}`, level: Math.floor(i / 5) + 1, order: i % 5 + 1,
  text: `Example question ${i + 1}`, a: "Choice A", b: "Choice B",
  correct: i % 2 ? "B" : "A", active: true, image: "",
}));
test("editable practice bank remains playable with available local pictures", () => {
  const playable = validateBank(bank);
  assert.equal(playable.length, bank.filter(q => q.active).length);
  assert.equal(VEHICLES.length, 5);
  for (const q of playable) {
    if (q.image && !/^https?:\/\//.test(q.image)) {
      assert.ok(existsSync(new URL(`../${q.image}`, import.meta.url)),
        `Picture missing for ${q.id}: ${q.image}`);
    }
  }
});
test("variable totals and scores depend only on accuracy", () => {
  assert.equal(
    score(
      sample.map((q) => q.correct),
      sample,
    ).score,
    100,
  );
  const a = sample.map((q, i) =>
    i < 12 ? q.correct : q.correct === "A" ? "B" : "A",
  );
  assert.equal(score(a, sample).score, 80);
  assert.equal(
    score(
      ["A", "A", "A"],
      [
        { level: 1, correct: "A" },
        { level: 2, correct: "B" },
        { level: 3, correct: "B" },
      ],
    ).score,
    33.33,
  );
});
test("invalid samples rejected", () => {
  for (const mutate of [
    (b) => (b[1].id = b[0].id),
    (b) => (b[1].order = b[0].order),
    (b) => (b[0].a = ""),
    (b) => b.forEach((q) => (q.level = 1)),
  ]) {
    const b = structuredClone(sample);
    mutate(b);
    assert.throws(() => validateBank(b));
  }
});
test("collision requires overlap in both axes", () => {
  const p = { x: 550, y: 500, w: 80, h: 100 };
  assert.equal(collision(p, { x: 550, y: 490, w: 55, h: 55 }), true);
  assert.equal(collision(p, { x: 390, y: 490, w: 55, h: 55 }), false);
  assert.equal(collision(p, { x: 550, y: 200, w: 55, h: 55 }), false);
});
