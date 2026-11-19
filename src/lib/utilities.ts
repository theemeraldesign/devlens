export function prettyJson(source: string): string {
  return JSON.stringify(JSON.parse(source), null, 2);
}

export function inspectJwt(token: string): { header: unknown; payload: unknown } {
  const parts = token.trim().split(".");
  if (parts.length !== 3) throw new Error("A JWT must contain three segments.");
  const decode = (part: string) => {
    const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(Array.from(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="))).map(c => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join("")));
  };
  return { header: decode(parts[0]), payload: decode(parts[1]) };
}

export function toBase64(value: string): string {
  return btoa(unescape(encodeURIComponent(value)));
}

export function fromBase64(value: string): string {
  return decodeURIComponent(Array.from(atob(value.trim())).map(c => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join(""));
}

export function encodeUrl(value: string): string {
  return encodeURIComponent(value);
}

export function decodeUrl(value: string): string {
  return decodeURIComponent(value);
}

export function createUuid(): string {
  return crypto.randomUUID();
}

export function exportCurl(input: { method: string; url: string; headers: Record<string, string>; body?: string }): string {
  const quote = (value: string) => "'" + value.replace(/'/g, "'\\''") + "'";
  const lines = ["curl", quote(input.url), "-X", input.method.toUpperCase()];
  for (const [key, value] of Object.entries(input.headers)) lines.push("-H", quote(key + ": " + value));
  if (input.body) lines.push("--data-raw", quote(input.body));
  return lines.join(" \\\n  ");
}

export function safePublicCollection(value: unknown): unknown {
  const blocked = /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key|password|secret|client_secret)$/i;
  const visit = (input: unknown): unknown => {
    if (Array.isArray(input)) {
      return input
        .filter(item => {
          if (!item || typeof item !== "object") return true;
          const row = item as Record<string, unknown>;
          const label = String(row.key ?? row.name ?? "");
          return !blocked.test(label) && !/token|secret|password|credential/i.test(label);
        })
        .map(visit);
    }
    if (!input || typeof input !== "object") return input;
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(input)) {
      if (blocked.test(key) || /token|secret|password|credential/i.test(key)) continue;
      if (key.toLowerCase() === "headers" && child && typeof child === "object") {
        if (Array.isArray(child)) {
          output[key] = child
            .filter(row => {
              if (!row || typeof row !== "object") return false;
              const header = row as Record<string, unknown>;
              const label = String(header.key ?? header.name ?? "");
              return !blocked.test(label) && !/token|secret|password|credential/i.test(label);
            })
            .map(visit);
        } else {
          output[key] = Object.fromEntries(Object.entries(child as Record<string, unknown>).filter(([name]) => !blocked.test(name) && !/token|secret|password|credential/i.test(name)).map(([name, value]) => [name, visit(value)]));
        }
        continue;
      }
      output[key] = visit(child);
    }
    return output;
  };
  return visit(value);
}
