export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
export type HeaderPair = { id: string; key: string; value: string; enabled: boolean };
export type ApiRequest = { method: HttpMethod; url: string; headers: HeaderPair[]; body: string };
export type ApiResponse = { status: number; statusText: string; duration: number; size: number; headers: Record<string, string>; body: string };

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

export async function sendRequest(request: ApiRequest, signal?: AbortSignal): Promise<ApiResponse> {
  const started = performance.now();
  const headers = Object.fromEntries(request.headers.filter(h => h.enabled && h.key.trim()).map(h => [h.key.trim(), h.value]));
  const response = await fetch("/api/proxy", {
    method: "POST",
    headers: { "content-type": "application/json", "x-devlens-client-id": getClientId() },
    body: JSON.stringify({ method: request.method, url: request.url, headers, body: request.body }),
    signal
  });
  const payload = await response.json() as ApiResponse & { error?: string };
  if (!response.ok && payload.error) throw new Error(payload.error);
  return { ...payload, duration: Math.round(performance.now() - started) };
}

export function formatJson(value: string): string {
  return JSON.stringify(JSON.parse(value), null, 2);
}
