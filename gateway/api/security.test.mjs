import test from "node:test";
import assert from "node:assert/strict";
import { createSignature, verifySignature, validateEnvelope } from "./security.mjs";
import { isSafeIpAddress } from "guarded-fetch";

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

test("guarded-fetch rejects private, loopback and metadata IP ranges", () => {
  for (const address of ["127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1", "169.254.169.254", "::1", "fc00::1", "fe80::1", "100.64.0.1"]) {
    assert.equal(isSafeIpAddress(address), false, address);
  }
});

test("guarded-fetch permits public destination IPs", () => {
  for (const address of ["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"]) {
    assert.equal(isSafeIpAddress(address), true, address);
  }
});
