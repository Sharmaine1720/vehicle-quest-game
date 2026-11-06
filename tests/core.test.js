import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
test("15 initial questions, two choices, five per level", () => {
  assert.equal(validateBank(bank).length, 15);
  assert.deepEqual(
    [1, 2, 3].map((l) => bank.filter((q) => q.level === l).length),
    [5, 5, 5],
  );
  assert.equal(bank.map((q) => q.correct).join(""), "ABABABABABABABA");
  assert.equal(VEHICLES.length, 5);
  for (const q of bank) {
    assert.ok(q.a);
    assert.ok(q.b);
  }
});
test("variable totals and scores depend only on accuracy", () => {
  assert.equal(
    score(
      bank.map((q) => q.correct),
      bank,
    ).score,
    100,
  );
  const a = bank.map((q, i) =>
    i < 12 ? q.correct : q.correct === "A" ? "B" : "A",
  );
  assert.equal(score(a, bank).score, 80);
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
test("invalid banks rejected", () => {
  for (const mutate of [
    (b) => (b[1].id = b[0].id),
    (b) => (b[1].order = b[0].order),
    (b) => (b[0].a = ""),
    (b) => b.forEach((q) => (q.level = 1)),
  ]) {
    const b = structuredClone(bank);
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
