import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./backend-fixture.js";
const info = {
  student: { name: '=HYPERLINK("bad")', grade: 4, class: "401", number: "01" },
  vehicle: "car",
};
test("anonymous users cannot read drafts, publish, restore, or upload", () => {
  const f = fixture();
  f.setEmail("");
  for (const action of [
    "load",
    "save",
    "publish",
    "restore",
    "upload",
    "history",
  ])
    assert.throws(() => f.c.teacherRequest(action, {}), /denied/);
});
test("student projection hides answer keys and validates registration", () => {
  const { c } = fixture();
  const s = c.publicRequest("start", info);
  assert.equal(s.questions.length, 15);
  assert.ok(s.questions.every((q) => !("correct" in q)));
  assert.throws(
    () =>
      c.publicRequest("start", {
        ...info,
        student: { ...info.student, class: "501" },
      }),
    /Invalid/,
  );
});
test("answers are sequential, locked and safely retryable", () => {
  const { c } = fixture();
  const s = c.publicRequest("start", info);
  assert.throws(
    () => c.publicRequest("complete", { token: s.token }),
    /Finish/,
  );
  assert.throws(
    () =>
      c.publicRequest("answer", {
        token: s.token,
        questionId: "q2",
        choice: "B",
      }),
    /current/,
  );
  const a = { token: s.token, questionId: "q1", choice: "A" };
  assert.equal(c.publicRequest("answer", a).correct, true);
  assert.equal(c.publicRequest("answer", a).correct, true);
  assert.throws(
    () => c.publicRequest("answer", { ...a, choice: "B" }),
    /locked/,
  );
});
test("draft isolation, pinned sessions, restore, deduplicated server grading", () => {
  const { c, sheets } = fixture();
  const s = c.publicRequest("start", info),
    d = c.teacherRequest("load").draft;
  d.questions[0].correct = "B";
  c.teacherRequest("save", d);
  assert.equal(c.version_(s.version).questions[0].correct, "A");
  const revision = c.teacherRequest("load").draft.revision;
  const published = c.teacherRequest("publish", { revision }).version;
  assert.notEqual(published, s.version);
  const old = c.version_(s.version);
  for (const q of old.questions)
    c.publicRequest("answer", {
      token: s.token,
      questionId: q.id,
      choice: q.correct,
    });
  const result = c.publicRequest("complete", { token: s.token, score: 0 });
  assert.equal(result.score, 100);
  assert.equal(
    c.publicRequest("complete", { token: s.token }).submissionId,
    result.submissionId,
  );
  assert.equal(sheets.get("Student Scores").getLastRow(), 2);
  const row = sheets.get("Student Scores").rows[1];
  assert.ok(row[2].startsWith("'="));
  assert.equal(row[5], "'01");
  assert.equal(row[10], 100);
  const restored = c.teacherRequest("restore", { id: s.version }).version;
  assert.notEqual(restored, s.version);
  assert.equal(c.teacherRequest("history").length, 3);
  assert.equal(c.version_(restored).questions[0].correct, "A");
});
test("incomplete drafts save; publish rejects; stale revisions rejected", () => {
  const { c } = fixture();
  const d = c.teacherRequest("load").draft;
  d.questions[0].text = "";
  const { revision } = c.teacherRequest("save", d);
  assert.throws(() => c.teacherRequest("save", d), /Another editor/);
  assert.throws(() => c.teacherRequest("publish", { revision }), /needs text/);
});
test("expired and forged sessions rejected; settings validated", () => {
  const { c, sheets } = fixture();
  assert.throws(() => c.publicRequest("complete", { token: "bad" }), /Invalid/);
  const s = c.publicRequest("start", info),
    row = sheets.get("Sessions").rows[1],
    data = JSON.parse(row[2]);
  data.started = Date.now() - 25 * 3600000;
  row[2] = JSON.stringify(data);
  assert.throws(
    () => c.publicRequest("complete", { token: s.token }),
    /expired/,
  );
  assert.throws(() => c.checkSettings_({ speed: 999 }), /Invalid/);
});
test("image uploads enforce type, size, signature, authorization and private references", () => {
  const { c } = fixture();
  const data =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lGQAAAAASUVORK5CYII=";
  const r = c.teacherRequest("upload", { mime: "image/png", data });
  assert.ok(r.id.startsWith("image_"));
  assert.ok(
    c.teacherRequest("image", { id: r.id }).startsWith("data:image/png"),
  );
  assert.throws(
    () => c.teacherRequest("upload", { mime: "image/svg+xml", data }),
    /Upload/,
  );
  assert.throws(
    () => c.teacherRequest("upload", { mime: "image/jpeg", data }),
    /contents/,
  );
  assert.throws(
    () =>
      c.teacherRequest("upload", {
        mime: "image/png",
        data: "A".repeat(267001),
      }),
    /under/,
  );
  assert.throws(
    () => c.teacherRequest("image", { id: "unknown" }),
    /not found/,
  );
});
