interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  MAX_REQUEST_BYTES: string;
  MAX_RESPONSE_BYTES: string;
  REQUEST_TIMEOUT_MS: string;
}

const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
const PRIVATE_HOSTS = /^(localhost|.*\.localhost|.*\.local|metadata\.google\.internal)$/i;

function isPrivateAddress(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (PRIVATE_HOSTS.test(h) || h === "::1" || h === "0.0.0.0" || h === "::") return true;
  if (h.startsWith("10.") || h.startsWith("127.") || h.startsWith("192.168.") || h.startsWith("169.254.")) return true;
  const m = h.match(/^172\.(\d+)\./);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  if (h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80:")) return true;
  return false;
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}

async function proxy(request: Request, env: Env): Promise<Response> {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > Number(env.MAX_REQUEST_BYTES || 1048576)) return json({ error: "Request payload is too large." }, 413);
  let input: { method?: string; url?: string; headers?: Record<string, string>; body?: string };
  try { input = await request.json(); } catch { return json({ error: "Invalid JSON payload." }, 400); }
  const method = String(input.method || "GET").toUpperCase();
  if (!METHODS.has(method)) return json({ error: "HTTP method is not allowed." }, 400);
  let target: URL;
  try { target = new URL(String(input.url || "")); } catch { return json({ error: "Enter a valid URL." }, 400); }
  if (!["http:", "https:"].includes(target.protocol)) return json({ error: "Only HTTP and HTTPS URLs are supported." }, 400);
  if (target.username || target.password || isPrivateAddress(target.hostname)) return json({ error: "This destination is not allowed." }, 403);

  const headers = new Headers();
  for (const [key, value] of Object.entries(input.headers || {})) {
    if (/^(host|content-length|connection|transfer-encoding|cookie|origin|referer)$/i.test(key)) continue;
    headers.set(key, String(value));
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(Number(env.REQUEST_TIMEOUT_MS || 20000), 30000));
  try {
    const upstream = await fetch(target, {
      method, headers, body: ["GET", "HEAD"].includes(method) ? undefined : String(input.body || ""),
      redirect: "manual", signal: controller.signal
    });
    if (upstream.status >= 300 && upstream.status < 400) return json({ error: "Redirects are blocked. Send a request to the destination URL directly." }, 400);
    const reader = upstream.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    const limit = Number(env.MAX_RESPONSE_BYTES || 5242880);
    if (reader) {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > limit) { await reader.cancel(); return json({ error: "Response exceeded the 5 MB inspection limit." }, 413); }
        chunks.push(part.value);
      }
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const body = new TextDecoder().decode(bytes);
    const responseHeaders = Object.fromEntries([...upstream.headers.entries()].filter(([k]) => !["set-cookie"].includes(k.toLowerCase())));
    return json({ status: upstream.status, statusText: upstream.statusText, duration: 0, size, headers: responseHeaders, body });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "The request timed out." : "The upstream request failed.";
    return json({ error: message }, 502);
  } finally { clearTimeout(timeout); }
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