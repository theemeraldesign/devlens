import test from "node:test";
import assert from "node:assert/strict";
import { createSignature, verifySignature, validateEnvelope } from "./security.mjs";

const secret = "test-secret-for-signature-checks";
const envelope = {
  userId: "user-123456789",
  method: "GET",
  url: "https://example.com/api",
  headers: { accept: "application/json" },
  body: "",
  bodyType: "json"
};

test("accepts a valid, current HMAC signature", () => {
  const timestamp = String(Date.now());
  const raw = JSON.stringify(envelope);
  assert.equal(verifySignature(secret, timestamp, raw, createSignature(secret, timestamp, raw)), true);
});

test("rejects a modified body, wrong secret, and expired timestamp", () => {
  const timestamp = String(Date.now());
  const raw = JSON.stringify(envelope);
  const signature = createSignature(secret, timestamp, raw);
  assert.equal(verifySignature(secret, timestamp, raw + " ", signature), false);
  assert.equal(verifySignature("wrong-secret", timestamp, raw, signature), false);
  assert.equal(verifySignature(secret, String(Date.now() - 60_000), raw, signature), false);
});

test("rejects invalid destinations and unsupported methods", () => {
  assert.match(validateEnvelope({ ...envelope, url: "file:///etc/passwd" }), /Destination/);
  assert.match(validateEnvelope({ ...envelope, method: "TRACE" }), /method/);
  assert.equal(validateEnvelope(envelope), null);
});

test("rejects oversized or malformed header collections", () => {
  assert.match(validateEnvelope({ ...envelope, headers: Object.fromEntries(Array.from({ length: 61 }, (_, i) => ["x-" + i, "v"])) }), /headers/);
  assert.match(validateEnvelope({ ...envelope, headers: { authorization: "x".repeat(9000) } }), /header/);
});
