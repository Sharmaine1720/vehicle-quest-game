import test from "node:test";
import assert from "node:assert/strict";
import { Backend } from "../js/api.js";

function fixture(t) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const original = globalThis.window;
  let onMessage;
  globalThis.window = {
    addEventListener(type, fn) {
      assert.equal(type, "message");
      onMessage = fn;
    },
  };
  t.after(() => {
    if (original === undefined) delete globalThis.window;
    else globalThis.window = original;
  });
  const backend = new Backend("https://script.google.com/macros/s/test/exec");
  const sent = [];
  backend.frame = {};
  backend.bridge = { postMessage: (message) => sent.push(message) };
  backend.bridgeOrigin = "https://n-test-script.googleusercontent.com";
  backend.connect = async () => {};
  return {
    backend,
    sent,
    respond(id, result) {
      onMessage({
        origin: backend.bridgeOrigin,
        source: backend.bridge,
        data: { type: "vq-response", channel: backend.channel, id, result },
      });
    },
  };
}
for (const action of ["start", "answer", "complete"]) {
  test(`${action} accepts a Google response after 65 seconds`, async (t) => {
    const f = fixture(t);
    let settled = false;
    const request = f.backend.request(action).finally(() => {
      settled = true;
    });
    await Promise.resolve();
    t.mock.timers.tick(65000);
    await Promise.resolve();
    assert.equal(settled, false);
    assert.equal(f.backend.pending.size, 1);
    f.respond(f.sent[0].id, { ok: true });
    assert.deepEqual(await request, { ok: true });
    assert.equal(f.backend.pending.size, 0);
    // A cleared timer must not turn a successful response into an error later.
    t.mock.timers.tick(180000);
  });
}
for (const [action, deadline] of [
  ["start", 120000],
  ["answer", 90000],
  ["complete", 90000],
]) {
  test(`${action} still fails after its deadline and ignores late replies`, async (t) => {
    const f = fixture(t);
    const request = f.backend.request(action);
    const rejected = assert.rejects(
      request,
      action === "start" ? /2 minutes/ : /90 seconds/,
    );
    await Promise.resolve();
    t.mock.timers.tick(deadline - 1);
    assert.equal(f.backend.pending.size, 1);
    t.mock.timers.tick(1);
    await rejected;
    assert.equal(f.backend.pending.size, 0);
    f.respond(f.sent[0].id, { ok: true });
    assert.equal(f.backend.pending.size, 0);
  });
}
