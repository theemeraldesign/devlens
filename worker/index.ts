interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  MAX_REQUEST_BYTES: string;
  MAX_RESPONSE_BYTES: string;
  REQUEST_TIMEOUT_MS: string;
  API_RATE_LIMITER: RateLimit;
}

type ProxyInput = {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: string;
  bodyType?: "json" | "text" | "urlencoded" | "formdata";
};

const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
const PRIVATE_HOSTS = /^(localhost|.*\.localhost|.*\.local|.*\.internal|.*\.intranet|.*\.lan|.*\.home\.arpa|metadata\.google\.internal)$/i;

export function isPrivateAddress(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  if (PRIVATE_HOSTS.test(h)) return true;

  if (h.includes(":")) {
    if (h.startsWith("::ffff:")) {
      const mapped = h.slice(7);
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(mapped)) return isPrivateAddress(mapped);
      return true;
    }
    if (h === "::" || h === "::1" || h.startsWith("fc") || h.startsWith("fd") || /^fe[89ab]/.test(h) || h.startsWith("ff")) return true;
    const first = Number.parseInt(h.split(":")[0] || "0", 16);
    if ((first & 0xe000) !== 0x2000) return true;
    if (h.startsWith("2001:db8") || h.startsWith("2001:10:") || h.startsWith("2001:2:")) return true;
    return false;
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {
    const [a,b,c] = h.split(".").map(Number);
    if ([a,b,c].some(n => n < 0 || n > 255)) return true;
    if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
        (a === 100 && b >= 64 && b <= 127) || (a === 192 && b === 0 && c === 0) ||
        (a === 192 && b === 0 && c === 2) || (a === 198 && (b === 18 || b === 19)) ||
        (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113) ||
        a === 255) return true;
  }
  return false;
}

function isIpLiteral(host: string): boolean {
  return host.includes(":") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

async function resolvesOnlyToPublicAddresses(host: string, signal: AbortSignal): Promise<boolean> {
  if (isIpLiteral(host)) return !isPrivateAddress(host);
  const results = await Promise.all(["A", "AAAA"].map(async type => {
    const endpoint = new URL("https://cloudflare-dns.com/dns-query");
    endpoint.searchParams.set("name", host);
    endpoint.searchParams.set("type", type);
    const response = await fetch(endpoint, { headers: { accept: "application/dns-json" }, signal });
    if (!response.ok) throw new Error("DNS validation failed");
    return response.json() as Promise<{ Status?: number; Answer?: Array<{ type: number; data: string }> }>;
  }));
  if (results.some(result => result.Status !== 0)) return false;
  const answers = results.flatMap(result =>
    (result.Answer || []).filter(answer => answer.type === 1 || answer.type === 28).map(answer => answer.data)
  );
  if (!answers.length) return false;
  return answers.every(address => !isPrivateAddress(address));
}


export function buildOutboundBody(method: string, bodyType: ProxyInput["bodyType"], rawBody: string, headers: Headers): BodyInit | undefined {
  if (method === "GET" || method === "HEAD" || !rawBody) return undefined;
  if (bodyType === "formdata") {
    headers.delete("content-type");
    let rows: unknown;
    try { rows = JSON.parse(rawBody); } catch { throw new Error("Form-data must be a JSON array of key/value pairs."); }
    if (!Array.isArray(rows) || rows.length > 100) throw new Error("Form-data must contain no more than 100 fields.");
    const form = new FormData();
    for (const row of rows) {
      if (!row || typeof row !== "object") throw new Error("Each form-data field needs a key and text value.");
      const field = row as Record<string, unknown>;
      if (typeof field.key !== "string" || typeof field.value !== "string" ||
          !field.key.trim() || field.key.length > 256 || field.value.length > 100_000) {
        throw new Error("Each form-data field needs a key and text value. Keys are limited to 256 characters and values to 100 KB.");
      }
      form.append(field.key, field.value);
    }
    return form;
  }
  if (!headers.has("content-type")) {
    const contentType = bodyType === "text" ? "text/plain; charset=utf-8" :
      bodyType === "urlencoded" ? "application/x-www-form-urlencoded" : "application/json";
    headers.set("content-type", contentType);
  }
  return rawBody;
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}

async function readLimitedBody(request: Request, limit: number): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new Error("PAYLOAD_TOO_LARGE");
    }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

async function proxy(request: Request, env: Env): Promise<Response> {
  const ip = request.headers.get("cf-connecting-ip") || "local";
  const clientId = request.headers.get("x-devlens-client-id") || "anonymous";
  const safeClientId = clientId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64) || "anonymous";
  const allowance = await env.API_RATE_LIMITER.limit({ key: `${ip}:${safeClientId}` });
  if (!allowance.success) return json({ error: "Request limit reached. Wait one minute and try again." }, 429);

  const requestLimit = Number(env.MAX_REQUEST_BYTES || 1048576);
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > requestLimit) return json({ error: "Request payload is too large." }, 413);

  const controller = new AbortController();
  const abortFromClient = () => controller.abort();
  request.signal.addEventListener("abort", abortFromClient, { once: true });
  const timeout = setTimeout(() => controller.abort(), Math.min(Number(env.REQUEST_TIMEOUT_MS || 20000), 30000));
  try {
    let input: ProxyInput;
    try {
      const raw = await readLimitedBody(request, requestLimit);
      input = JSON.parse(raw) as ProxyInput;
    } catch (error) {
      if (error instanceof Error && error.message === "PAYLOAD_TOO_LARGE") return json({ error: "Request payload is too large." }, 413);
      return json({ error: "Invalid JSON payload." }, 400);
    }

    const method = String(input.method || "GET").toUpperCase();
    if (!METHODS.has(method)) return json({ error: "HTTP method is not allowed." }, 400);
    let target: URL;
    const rawUrl = String(input.url || "");
    if (rawUrl.length > 4096) return json({ error: "Request URL is too long." }, 400);
    try { target = new URL(rawUrl); } catch { return json({ error: "Enter a valid URL." }, 400); }
    if (!["http:", "https:"].includes(target.protocol)) return json({ error: "Only HTTP and HTTPS URLs are supported." }, 400);
    if (target.username || target.password || isPrivateAddress(target.hostname)) return json({ error: "This destination is not allowed." }, 403);

    // Resolve both address families and fail closed if any answer is private or DNS cannot be checked.
    if (!(await resolvesOnlyToPublicAddresses(target.hostname, controller.signal))) {
      return json({ error: "This hostname does not resolve to a permitted public address." }, 403);
    }

    const entries = Object.entries(input.headers || {});
    if (entries.length > 60) return json({ error: "Too many request headers." }, 400);
    const headers = new Headers();
    for (const [key, value] of entries) {
      if (/^(host|content-length|connection|transfer-encoding|cookie|origin|referer|proxy-authorization)$/i.test(key)) continue;
      if (key.length > 128 || String(value).length > 8192) return json({ error: "A request header is too large." }, 400);
      headers.set(key, String(value));
    }
    let body: BodyInit | undefined;
    try { body = buildOutboundBody(method, input.bodyType, String(input.body || ""), headers); }
    catch (error) { return json({ error: error instanceof Error ? error.message : "Invalid request body." }, 400); }

    // Redirects are deliberately not followed. The caller must submit the final URL for a fresh validation.
    const upstream = await fetch(target, { method, headers, body, redirect: "manual", signal: controller.signal });
    if (upstream.status >= 300 && upstream.status < 400) {
      return json({ error: "Redirects are blocked. Send a request to the destination URL directly." }, 400);
    }

    const reader = upstream.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    const responseLimit = Number(env.MAX_RESPONSE_BYTES || 5242880);
    if (reader) {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > responseLimit) {
          await reader.cancel();
          return json({ error: "Response exceeded the 5 MB inspection limit." }, 413);
        }
        chunks.push(part.value);
      }
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const bodyText = new TextDecoder().decode(bytes);
    const responseHeaders = Object.fromEntries([...upstream.headers.entries()].filter(([key]) => !["set-cookie"].includes(key.toLowerCase())));
    return json({ status: upstream.status, statusText: upstream.statusText, duration: 0, size, headers: responseHeaders, body: bodyText });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "The request timed out." : "The upstream request failed.";
    return json({ error: message }, 502);
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", abortFromClient);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") return json({ ok: true, service: "devlens" });
    if (url.pathname === "/api/proxy" && request.method === "POST") return proxy(request, env);
    if (url.pathname.startsWith("/api/")) return json({ error: "Not found." }, 404);
    return env.ASSETS.fetch(request);
  }
};
