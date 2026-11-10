import test from "node:test";
import assert from "node:assert/strict";
import { QuestionPictures } from "../js/pictures.js";
const image = "data:image/png;base64,example";
test("upcoming pictures are deduplicated without holding race startup", async () => {
  let resolve,
    calls = 0;
  const pictures = new QuestionPictures(
    {
      request(action, payload) {
        assert.equal(action, "image");
        assert.equal(payload.token, "session");
        calls++;
        return new Promise((r) => (resolve = r));
      },
    },
    "session",
  );
  const first = { id: "q1", imageRef: "shared" },
    next = { id: "q2", imageRef: "shared" };
  pictures.prefetch([first, next]);
  await Promise.resolve();
  assert.equal(calls, 1);
  const loaded = pictures.load(first);
  resolve({ image });
  assert.equal(await loaded, image);
  assert.equal(await pictures.load(next), image);
  assert.equal(calls, 1);
});
test("failed pictures can be retried and invalid data is rejected", async () => {
  let calls = 0;
  const pictures = new QuestionPictures(
    {
      request: async () => {
        calls++;
        return { image: calls === 1 ? "not-an-image" : image };
      },
    },
    "session",
  );
  const question = { id: "q1", imageRef: "file" };
  await assert.rejects(pictures.load(question), /unavailable/);
  assert.equal(await pictures.load(question), image);
  assert.equal(calls, 2);
});
test("inline pictures and questions without pictures require no backend calls", async () => {
  const pictures = new QuestionPictures(
    {
      request() {
        throw Error("Unexpected request");
      },
    },
    "session",
  );
  assert.equal(await pictures.load({ image }), image);
  assert.equal(await pictures.load({ image: "" }), "");
});

test("different pictures load one at a time and a failure does not block the queue", async () => {
  const calls = [],
    controls = [];
  const pictures = new QuestionPictures(
    {
      request(action, payload) {
        calls.push(payload.questionId);
        return new Promise((resolve, reject) =>
          controls.push({ resolve, reject }),
        );
      },
    },
    "session",
  );
  const first = pictures.load({ id: "q1", imageRef: "file1" });
  const failed = assert.rejects(first, /failed/);
  const second = pictures.load({ id: "q2", imageRef: "file2" });
  await Promise.resolve();
  assert.deepEqual(calls, ["q1"]);
  controls[0].reject(Error("failed"));
  await failed;
  // Let the queue start its second request before checking its active call.
  for (let i = 0; i < 5 && calls.length < 2; i++) await Promise.resolve();
  assert.deepEqual(calls, ["q1", "q2"]);
  controls[1].resolve({ image });
  assert.equal(await second, image);
});
