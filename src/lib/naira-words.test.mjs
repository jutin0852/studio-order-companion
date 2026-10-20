import assert from "node:assert/strict";
import test from "node:test";
import { integerToWords, nairaInWords } from "./naira-words.ts";

test("whole amounts", () => {
  assert.equal(nairaInWords(45000), "Forty-five thousand naira only");
  assert.equal(nairaInWords(1), "One naira only");
  assert.equal(nairaInWords(120), "One hundred and twenty naira only");
  assert.equal(nairaInWords(2500000), "Two million, five hundred thousand naira only");
});

test("kobo", () => {
  assert.equal(nairaInWords(1500.5), "One thousand, five hundred naira, fifty kobo only");
  assert.equal(nairaInWords(0.75), "Seventy-five kobo only");
});

test("hundreds join with and, thousands groups with commas", () => {
  assert.equal(integerToWords(101), "one hundred and one");
  assert.equal(integerToWords(1001), "one thousand and one");
  assert.equal(integerToWords(100000), "one hundred thousand");
});

test("rejects invalid amounts", () => {
  assert.throws(() => nairaInWords(0));
  assert.throws(() => nairaInWords(Number.NaN));
});
