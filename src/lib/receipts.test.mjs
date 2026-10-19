import assert from "node:assert/strict";
import test from "node:test";
import { cleanAddress, cleanHandle, cleanPhone, formatReceiptNumber, isHexColor, isPaymentMethod, logoForRender } from "./receipts.ts";

test("receipt numbers are zero padded to seven digits", () => {
  assert.equal(formatReceiptNumber(1), "0000001");
  assert.equal(formatReceiptNumber(1148), "0001148");
});

test("handles drop a leading @ and reject unsafe characters", () => {
  assert.equal(cleanHandle(" @glad.style "), "glad.style");
  assert.equal(cleanHandle(""), null);
  assert.equal(cleanHandle(undefined), null);
  assert.equal(cleanHandle("bad handle"), undefined);
  assert.equal(cleanHandle("a".repeat(61)), undefined);
  assert.equal(cleanHandle(42), undefined);
});

test("phone numbers accept common formats only", () => {
  assert.equal(cleanPhone("0802 329 7930"), "0802 329 7930");
  assert.equal(cleanPhone("+234 802-329-7930"), "+234 802-329-7930");
  assert.equal(cleanPhone("  "), null);
  assert.equal(cleanPhone("call me"), undefined);
});

test("addresses are trimmed, collapsed and length limited", () => {
  assert.equal(cleanAddress("  6A   5th Avenue "), "6A 5th Avenue");
  assert.equal(cleanAddress("x".repeat(161)), undefined);
  assert.equal(cleanAddress(""), null);
});

test("colour and payment method validation", () => {
  assert.equal(isHexColor("#B3273A"), true);
  assert.equal(isHexColor("red"), false);
  assert.equal(isHexColor("#B3273"), false);
  assert.equal(isPaymentMethod("transfer"), true);
  assert.equal(isPaymentMethod("bitcoin"), false);
});

test("Cloudinary logos are converted to PNG for the renderer", () => {
  assert.equal(
    logoForRender("https://res.cloudinary.com/demo/image/upload/v1/a.webp"),
    "https://res.cloudinary.com/demo/image/upload/f_png,w_400/v1/a.webp",
  );
  assert.equal(logoForRender(null), null);
});
