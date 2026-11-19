interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  MAX_REQUEST_BYTES: string;
  MAX_RESPONSE_BYTES: string;
  REQUEST_TIMEOUT_MS: string;
  API_RATE_LIMITER: RateLimit;
  PROXY_EGRESS_ENABLED: string;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  EGRESS_GATEWAY_URL: string;
  EGRESS_SHARED_SECRET: string;
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

function ipv6ToBigInt(address: string): bigint | null {
  let value = address.toLowerCase().split("%")[0];
  if (value.includes(".")) {
    const lastColon = value.lastIndexOf(":");
    if (lastColon < 0) return null;
    const octets = value.slice(lastColon + 1).split(".").map(Number);
    if (octets.length !== 4 || octets.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return null;
    const high = ((octets[0] << 8) | octets[1]).toString(16);
    const low = ((octets[2] << 8) | octets[3]).toString(16);
    value = value.slice(0, lastColon + 1) + high + ":" + low;
  }
  const halves = value.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = halves.length === 2 ? 8 - left.length - right.length : 0;
  if ((halves.length === 1 && left.length !== 8) || (halves.length === 2 && missing < 1)) return null;
  const parts = halves.length === 2 ? [...left, ...Array(missing).fill("0"), ...right] : left;
  if (parts.length !== 8 || parts.some(part => !/^[0-9a-f]{1,4}$/.test(part))) return null;
  return parts.reduce((total, part) => (total << 16n) | BigInt("0x" + part), 0n);
}

function ipv6InCidr(address: bigint, network: bigint, prefix: number): boolean {
  const mask = ((1n << BigInt(prefix)) - 1n) << BigInt(128 - prefix);
  return (address & mask) === (network & mask);
}

export function isPrivateAddress(host: string): boolean {
  const trimmedHost = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  const h = trimmedHost.toLowerCase().split("%")[0];
  if (PRIVATE_HOSTS.test(h)) return true;

  if (h.includes(":")) {
    const address = ipv6ToBigInt(h);
    if (address === null) return true;
    const globalUnicastStart = 0x20000000000000000000000000000000n; // 2000::/3
    const globalUnicastEnd = 0x3fffffffffffffffffffffffffffffffn;
    if (address < globalUnicastStart || address > globalUnicastEnd) return true;
    // Special-purpose ranges inside global unicast: protocol assignments, documentation and 6to4.
    if (ipv6InCidr(address, 0x20010000000000000000000000000000n, 23) ||
        ipv6InCidr(address, 0x20010db8000000000000000000000000n, 32) ||
        ipv6InCidr(address, 0x20020000000000000000000000000000n, 16) ||
        ipv6InCidr(address, 0x3fff0000000000000000000000000000n, 20)) return true;
    return false;
  }

  if (/^[0-9]{1,3}([.][0-9]{1,3}){3}$/.test(h)) {
    const octets = h.split(".").map(Number);
    if (octets.length !== 4 || octets.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true;
    const [a,b,c] = octets;
    if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
        (a === 100 && b >= 64 && b <= 127) || (a === 192 && b === 0 && c === 0) ||
        (a === 192 && b === 0 && c === 2) || (a === 192 && b === 88 && c === 99) ||
        (a === 198 && (b === 18 || b === 19)) ||
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

export function isProxyEgressEnabled(value: string | undefined): boolean {
  return value === "true";
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
  // The client ID is user-controlled. Rate-limit by the platform-provided client IP so callers cannot rotate IDs to evade limits.
  const allowance = await env.API_RATE_LIMITER.limit({ key: "ip:" + ip });
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
    if (!["http:", "https:"].includes(target.protocol) || target.username || target.password || isPrivateAddress(target.hostname)) {
      return json({ error: "This destination is not allowed." }, 403);
    }

    const bearer = request.headers.get("authorization") || "";
    const tokenMatch = bearer.match(/^Bearer\\s+(.+)$/i);
    if (!tokenMatch || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || !env.EGRESS_GATEWAY_URL || !env.EGRESS_SHARED_SECRET) {
      return json({ error: "Sign in is required to use the secure request gateway." }, 401);
    }
    const identityResponse = await fetch(new URL("/auth/v1/user", env.SUPABASE_URL), {
      headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, authorization: "Bearer " + tokenMatch[1] },
      signal: controller.signal
    });
    if (!identityResponse.ok) return json({ error: "Your session is invalid or has expired. Sign in again." }, 401);
    const identity = await identityResponse.json() as { id?: string };
    if (!identity.id) return json({ error: "Unable to verify your account session." }, 401);
    const userAllowance = await env.API_RATE_LIMITER.limit({ key: "user:" + identity.id });
    if (!userAllowance.success) return json({ error: "Your request limit has been reached. Wait one minute and try again." }, 429);

    const entries = Object.entries(input.headers || {});
    if (entries.length > 60) return json({ error: "Too many request headers." }, 400);
    const headers = new Headers();
    for (const [key, value] of entries) {
      if (/^(host|content-length|connection|transfer-encoding|cookie|origin|referer|proxy-authorization)$/i.test(key)) continue;
      if (key.length > 128 || String(value).length > 8192) return json({ error: "A request header is too large." }, 400);
      headers.set(key, String(value));
    }
    try { buildOutboundBody(method, input.bodyType, String(input.body || ""), new Headers(headers)); }
    catch (error) { return json({ error: error instanceof Error ? error.message : "Invalid request body." }, 400); }

    const envelope = {
      userId: identity.id,
      method,
      url: target.toString(),
      headers: Object.fromEntries(headers.entries()),
      body: String(input.body || ""),
      bodyType: input.bodyType || "json"
    };
    const rawEnvelope = JSON.stringify(envelope);
    const timestamp = String(Date.now());
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.EGRESS_SHARED_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signatureBytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(timestamp + "." + rawEnvelope)));
    const signature = [...signatureBytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
    const gatewayResponse = await fetch(env.EGRESS_GATEWAY_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-devlens-timestamp": timestamp, "x-devlens-signature": signature },
      body: rawEnvelope,
      signal: controller.signal
    });
    const gatewayPayload = await gatewayResponse.json() as Record<string, unknown>;
    if (!gatewayResponse.ok) return json({ error: String(gatewayPayload.error || "The secure request gateway rejected the request.") }, gatewayResponse.status);
    if (typeof gatewayPayload.status !== "number" || typeof gatewayPayload.body !== "string") {
      return json({ error: "The secure request gateway returned an invalid response." }, 502);
    }
    if (gatewayPayload.status >= 300 && gatewayPayload.status < 400) {
      return json({ error: "Redirects are blocked. Send a request to the destination URL directly." }, 400);
    }
    return json(gatewayPayload);
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
    if (url.pathname === "/api/proxy" && request.method === "POST") {
      if (!isProxyEgressEnabled(env.PROXY_EGRESS_ENABLED)) return json({ error: "The API request proxy is temporarily disabled while secure outbound networking is configured." }, 503);
      return proxy(request, env);
    }
    if (url.pathname.startsWith("/api/")) return json({ error: "Not found." }, 404);
    return env.ASSETS.fetch(request);
  }
};
