import assert from "node:assert/strict";
import test from "node:test";
import { __testing } from "../ntd/socrata.js";

test("Socrata retry policy covers throttling and transient upstream failures", () => {
  assert.equal(__testing.isRetryable({ statusCode: 429 }), true);
  assert.equal(__testing.isRetryable({ statusCode: 503 }), true);
  assert.equal(__testing.isRetryable({ statusCode: 400 }), false);
  assert.equal(__testing.isRetryable({ code: "ETIMEDOUT" }), true);
});

test("Socrata retry delay honors and caps Retry-After", () => {
  assert.equal(__testing.retryDelay(1, "2"), 2000);
  assert.equal(__testing.retryDelay(1, "60"), 5000);
  assert.equal(__testing.retryDelay(2), 800);
});
