import { guardedFetch } from "guarded-fetch";
import { validateEnvelope, verifySignature } from "./security.mjs";

export const config = { api: { bodyParser: false } };

const MAX_REQUEST_BYTES = 1_048_576;
const MAX_RESPONSE_BYTES = 5_242_880;
const TIMEOUT_MS = 20_000;

async function readRequest(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_REQUEST_BYTES) throw new Error("PAYLOAD_TOO_LARGE");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readResponse(response) {
  if (!response.body) return { body: "", size: 0 };
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("RESPONSE_TOO_LARGE");
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return { body: Buffer.concat(chunks).toString("utf8"), size };
}

function send(res, status, payload) {
  res.status(status).setHeader("cache-control", "no-store");
  res.setHeader("content-type", "application/json; charset=utf-8");
  return res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed." });
  const secret = process.env.DEVLENS_EGRESS_SECRET;
  if (!secret) return send(res, 503, { error: "Gateway is not configured." });

  let raw;
  try { raw = await readRequest(req); }
  catch (error) {
    return send(res, error?.message === "PAYLOAD_TOO_LARGE" ? 413 : 400, { error: "Invalid request body." });
  }

  const timestamp = req.headers["x-devlens-timestamp"];
  const signature = req.headers["x-devlens-signature"];
  if (!verifySignature(secret, String(timestamp || ""), raw, String(signature || ""))) {
    return send(res, 401, { error: "Gateway authentication failed." });
  }

  let input;
  try { input = JSON.parse(raw); }
  catch { return send(res, 400, { error: "Invalid JSON payload." }); }
  const invalid = validateEnvelope(input);
  if (invalid) return send(res, 400, { error: invalid });

  const headers = new Headers();
  for (const [key, value] of Object.entries(input.headers)) headers.set(key, value);
  let body;
  if (input.method !== "GET" && input.method !== "HEAD" && input.body) {
    if (input.bodyType === "formdata") {
      let rows;
      try { rows = JSON.parse(input.body); } catch { return send(res, 400, { error: "Invalid form-data payload." }); }
      if (!Array.isArray(rows) || rows.length > 100) return send(res, 400, { error: "Invalid form-data fields." });
      headers.delete("content-type");
      const form = new FormData();
      for (const row of rows) {
        if (!row || typeof row.key !== "string" || typeof row.value !== "string" || !row.key.trim() || row.key.length > 256 || row.value.length > 100_000) {
          return send(res, 400, { error: "Invalid form-data field." });
        }
        form.append(row.key, row.value);
      }
      body = form;
    } else {
      if (!headers.has("content-type")) {
        headers.set("content-type", input.bodyType === "text" ? "text/plain; charset=utf-8" : input.bodyType === "urlencoded" ? "application/x-www-form-urlencoded" : "application/json");
      }
      body = input.body;
    }
  }

  try {
    const upstream = await guardedFetch(input.url, {
      method: input.method,
      headers,
      body,
      timeoutMs: TIMEOUT_MS,
      followRedirects: false,
      opaqueErrors: true
    });
    const result = await readResponse(upstream);
    const responseHeaders = Object.fromEntries([...upstream.headers.entries()].filter(([key]) => !["set-cookie", "set-cookie2"].includes(key.toLowerCase())));
    return send(res, 200, {
      status: upstream.status,
      statusText: upstream.statusText,
      duration: 0,
      size: result.size,
      headers: responseHeaders,
      body: result.body
    });
  } catch (error) {
    if (error?.message === "RESPONSE_TOO_LARGE") return send(res, 413, { error: "Response exceeded the 5 MB inspection limit." });
    return send(res, error?.code === "timeout" ? 504 : 502, { error: "The upstream request failed or the destination was blocked." });
  }
}
