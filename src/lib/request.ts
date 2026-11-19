export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
export type HeaderPair = { id: string; key: string; value: string; enabled: boolean };
export type ApiRequest = { method: HttpMethod; url: string; headers: HeaderPair[]; body: string; bodyType?: "json" | "text" | "urlencoded" | "formdata" };
export type ApiResponse = { status: number; statusText: string; duration: number; size: number; headers: Record<string, string>; body: string };

const PROXY_DISABLED_MESSAGE = "The API request proxy is temporarily disabled while secure outbound networking is configured.";
const MAX_BROWSER_REQUEST_BYTES = 1024 * 1024;
const MAX_BROWSER_RESPONSE_BYTES = 5 * 1024 * 1024;

function getClientId(): string {
  try {
    const key = "devlens.client-id";
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(key, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

function buildBrowserBody(request: ApiRequest): BodyInit | undefined {
  if (!request.body || request.method === "GET" || request.method === "HEAD") return undefined;
  if (request.bodyType !== "formdata") return request.body;
  let fields: unknown;
  try { fields = JSON.parse(request.body); } catch { throw new Error("Form data is invalid. Recheck its fields and try again."); }
  if (!Array.isArray(fields)) throw new Error("Form data must be a list of fields.");
  const form = new FormData();
  for (const field of fields) {
    if (field && typeof field.key === "string" && field.key.trim()) {
      form.append(field.key, typeof field.value === "string" ? field.value : "");
    }
  }
  return form;
}

async function readLimitedResponse(response: Response): Promise<{ body: string; size: number }> {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_BROWSER_RESPONSE_BYTES) {
    throw new Error("The response exceeds DevLens's 5 MB browser-mode limit.");
  }
  if (!response.body) return { body: "", size: 0 };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BROWSER_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("The response exceeds DevLens's 5 MB browser-mode limit.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { body: new TextDecoder().decode(merged), size };
}

async function sendBrowserRequest(request: ApiRequest, signal?: AbortSignal): Promise<ApiResponse> {
  const started = performance.now();
  const headers = new Headers();
  for (const item of request.headers) {
    if (item.enabled && item.key.trim()) headers.set(item.key.trim(), item.value);
  }
  if (request.bodyType === "formdata") headers.delete("content-type");
  const body = buildBrowserBody(request);
  if (request.body && new TextEncoder().encode(request.body).byteLength > MAX_BROWSER_REQUEST_BYTES) {
    throw new Error("The request body exceeds DevLens's 1 MB browser-mode limit.");
  }
  try {
    const response = await fetch(request.url, {
      method: request.method,
      headers,
      body,
      signal,
      mode: "cors",
      credentials: "omit",
      redirect: "follow",
      referrerPolicy: "no-referrer"
    });
    const result = await readLimitedResponse(response);
    return {
      status: response.status,
      statusText: response.statusText,
      duration: Math.round(performance.now() - started),
      size: result.size,
      headers: Object.fromEntries(response.headers.entries()),
      body: result.body
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    if (error instanceof Error && (error.message.includes("5 MB") || error.message.includes("1 MB") || error.message.startsWith("Form data"))) throw error;
    throw new Error("The API proxy is unavailable, and the browser request was blocked or could not connect. The API must allow CORS from this site. Try an API with CORS enabled, or retry when the secure proxy is available.");
  }
}

export async function sendRequest(request: ApiRequest, signal?: AbortSignal): Promise<ApiResponse> {
  const started = performance.now();
  const headers = Object.fromEntries(request.headers.filter(h => h.enabled && h.key.trim()).map(h => [h.key.trim(), h.value]));
  const response = await fetch("/api/proxy", {
    method: "POST",
    headers: { "content-type": "application/json", "x-devlens-client-id": getClientId() },
    body: JSON.stringify({ method: request.method, url: request.url, headers, body: request.body, bodyType: request.bodyType }),
    signal
  });
  const payload = await response.json() as ApiResponse & { error?: string };
  if (response.status === 503 && payload.error === PROXY_DISABLED_MESSAGE) {
    return sendBrowserRequest(request, signal);
  }
  if (!response.ok && payload.error) throw new Error(payload.error);
  return { ...payload, duration: Math.round(performance.now() - started) };
}

export function formatJson(value: string): string {
  return JSON.stringify(JSON.parse(value), null, 2);
}
