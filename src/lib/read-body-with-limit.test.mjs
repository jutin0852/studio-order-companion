import assert from "node:assert/strict";
import test from "node:test";
import { readBodyWithinLimit } from "./read-body-with-limit.mjs";

test("reads a multipart body that fits the byte limit", async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("part one"));
      controller.enqueue(new TextEncoder().encode(" and two"));
      controller.close();
    },
  });

  const result = await readBodyWithinLimit(stream, 16);
  assert.equal(result.tooLarge, false);
  assert.equal(await result.body?.text(), "part one and two");
});

test("cancels a streamed request as soon as its bytes exceed the limit", async () => {
  let canceled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(6));
    },
    cancel() {
      canceled = true;
    },
  });

  const result = await readBodyWithinLimit(stream, 5);
  assert.equal(result.tooLarge, true);
  assert.equal(result.body, null);
  assert.equal(canceled, true);
});

test("handles an absent request body without buffering", async () => {
  assert.deepEqual(await readBodyWithinLimit(null, 5), { body: null, tooLarge: false });
});
