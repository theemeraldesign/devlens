import { createHmac, timingSafeEqual } from "node:crypto";

export function signingMessage(timestamp, rawBody) {
  return `${timestamp}.${rawBody}`;
}

export function createSignature(secret, timestamp, rawBody) {
  return createHmac("sha256", secret).update(signingMessage(timestamp, rawBody)).digest("hex");
}

export function verifySignature(secret, timestamp, rawBody, signature, now = Date.now()) {
  if (!secret || !/^\d{10,13}$/.test(String(timestamp)) || !/^[a-f0-9]{64}$/i.test(String(signature))) return false;
  const timestampMs = String(timestamp).length === 10 ? Number(timestamp) * 1000 : Number(timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(now - timestampMs) > 30_000) return false;
  const expected = Buffer.from(createSignature(secret, timestamp, rawBody), "hex");
  const supplied = Buffer.from(String(signature), "hex");
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export function validateEnvelope(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "Invalid request envelope.";
  const { userId, method, url, headers, body, bodyType } = value;
  if (typeof userId !== "string" || userId.length < 10 || userId.length > 128) return "Invalid user.";
  if (!["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(method)) return "HTTP method is not allowed.";
  if (typeof url !== "string" || url.length > 4096) return "Invalid request URL.";
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) return "Destination is not allowed.";
  } catch { return "Invalid request URL."; }
  if (!headers || typeof headers !== "object" || Array.isArray(headers) || Object.keys(headers).length > 60) return "Invalid request headers.";
  for (const [key, value] of Object.entries(headers)) {
    if (key.length > 128 || typeof value !== "string" || value.length > 8192) return "A request header is too large.";
  }
  if (typeof body !== "string" || body.length > 1_048_576) return "Request payload is too large.";
  if (!["json", "text", "urlencoded", "formdata", undefined].includes(bodyType)) return "Unsupported request body type.";
  return null;
}


export function collectResponseHeaders(headers, maxCount = 60, maxBytes = 16_384) {
  const result = {};
  let count = 0;
  let bytes = 0;
  for (const [key, value] of headers.entries()) {
    if (["set-cookie", "set-cookie2"].includes(key.toLowerCase())) continue;
    count += 1;
    bytes += Buffer.byteLength(key) + Buffer.byteLength(value);
    if (count > maxCount || bytes > maxBytes) {
      throw new Error("RESPONSE_HEADERS_TOO_LARGE");
    }
    result[key] = value;
  }
  return result;
}
