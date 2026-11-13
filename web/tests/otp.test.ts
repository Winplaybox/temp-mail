import { test } from "node:test";
import assert from "node:assert/strict";
import { extractOtp } from "../lib/server/otp.ts";

test("finds code next to keyword", () => {
  assert.equal(extractOtp("Your login", "Hi,\nYour verification code is 482913.\nThanks 2026"), "482913");
});
test("code in subject", () => {
  assert.equal(extractOtp("123456 is your Instagram code", ""), "123456");
});
test("ignores years without keyword", () => {
  assert.equal(extractOtp("Newsletter", "Best of 2026 deals, offer ends 2027"), null);
});
test("dashed alphanumeric code", () => {
  assert.equal(extractOtp("Confirm", "Enter this code: K7Q-9XM to continue"), "K7Q-9XM");
});
test("six-digit fallback", () => {
  assert.equal(extractOtp("Welcome", "Use 739204 to finish"), "739204");
});
