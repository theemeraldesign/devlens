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
  const blocked = /^(authorization|proxy-authorization|cookie|cookies|set-cookie|x-api-key|api[-_]?key|apikey|password|secret|client[-_]?secret|x-auth-token|auth|environment|environments|variables|history|request_history|owner_id|collection_id|user_id|email|username|full_name|display_name|phone|avatar|avatar_url|user_metadata|profile_id|author_id|created_by|profile|account)$/i;
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
      if (key.toLowerCase() === "url" && typeof child === "string") {
        output[key] = redactUrl(child);
        continue;
      }
      if (key.toLowerCase() === "body" && typeof child === "string") {
        try {
          output[key] = JSON.stringify(visit(JSON.parse(child)));
        } catch {
          output[key] = "";
        }
        continue;
      }
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

const sensitiveQueryKey = /^(key|api[-_]?key|apikey|x[-_]?api[-_]?key|token|access[-_]?token|refresh[-_]?token|x[-_]?auth[-_]?token|password|secret|client[-_]?secret|authorization|auth|session)$/i;

export function redactUrl(source: string): string {
  try {
    const url = new URL(source);
    url.username = "";
    url.password = "";
    for (const key of [...url.searchParams.keys()]) {
      if (sensitiveQueryKey.test(key)) url.searchParams.set(key, "[REDACTED]");
    }
    return url.toString();
  } catch {
    return "[INVALID URL]";
  }
}

export function safeSavedHeaders(headers: Array<{ key: string; value: string; enabled: boolean }>) {
  const sensitive = /authorization|proxy-authorization|cookie|token|secret|password|api[-_]?key|apikey/i;
  return headers.filter(header => !sensitive.test(header.key)).map(({ key, value, enabled }) => ({ key, value, enabled }));
}


export type ImportedCurlRequest = { method: string; url: string; headers: Record<string, string>; body: string };

function shellTokens(command: string): string[] {
  const tokens: string[] = [];
  let token = "";
  let quote: "'" | '"' | null = null;
  let started = false;
  for (let i = 0; i < command.length; i++) {
    const char = command[i];
    if (quote === "'") {
      if (char === "'") quote = null;
      else token += char;
      continue;
    }
    if (quote === '"') {
      if (char === '"') { quote = null; continue; }
      if (char === "\\" && i + 1 < command.length && ['"', "\\", "$"].includes(command[i + 1])) token += command[++i];
      else token += char;
      continue;
    }
    if (char === "'" || char === '"') { quote = char; started = true; continue; }
    if (char === "\\") {
      if (i + 1 >= command.length) throw new Error("The cURL command ends with an incomplete escape.");
      token += command[++i]; started = true; continue;
    }
    if (/\s/.test(char)) {
      if (started) { tokens.push(token); token = ""; started = false; }
      continue;
    }
    if ([";", "|", ">", "<", "&", "\n", "\r"].includes(char)) throw new Error("Shell operators and multi-command input are not supported.");
    token += char; started = true;
  }
  if (quote) throw new Error("The cURL command contains an unclosed quote.");
  if (started) tokens.push(token);
  return tokens;
}

export function importCurl(command: string): ImportedCurlRequest {
  if (command.length > 100000) throw new Error("The cURL command is too large.");
  if (command.includes("$(") || command.includes(String.fromCharCode(96))) throw new Error("Shell command substitution is not supported.");
  const tokens = shellTokens(command.trim());
  if (!tokens.length || !["curl", "curl.exe"].includes(tokens[0].toLowerCase())) throw new Error("Start with curl and provide a URL.");
  let method = "";
  let url = "";
  let body = "";
  let hasBody = false;
  const headers: Record<string, string> = {};
  const takeValue = (index: number, flag: string) => {
    const value = tokens[index + 1];
    if (value === undefined) throw new Error(flag + " requires a value.");
    return value;
  };
  for (let i = 1; i < tokens.length; i++) {
    const arg = tokens[i];
    if (arg === "-X" || arg === "--request") { method = takeValue(i++, arg).toUpperCase(); continue; }
    if (arg.startsWith("--request=")) { method = arg.slice(10).toUpperCase(); continue; }
    if (arg === "-H" || arg === "--header" || arg.startsWith("--header=")) {
      const raw = arg.startsWith("--header=") ? arg.slice(9) : takeValue(i++, arg);
      const split = raw.indexOf(":");
      if (split < 1) throw new Error("Each header must use the format Name: value.");
      headers[raw.slice(0, split).trim()] = raw.slice(split + 1).trim();
      continue;
    }
    if (["-d", "--data", "--data-raw", "--data-binary"].includes(arg) || arg.startsWith("--data=") || arg.startsWith("--data-raw=") || arg.startsWith("--data-binary=")) {
      body = arg.includes("=") && arg.startsWith("--") ? arg.slice(arg.indexOf("=") + 1) : takeValue(i++, arg);
      hasBody = true; continue;
    }
    if (arg === "-u" || arg === "--user") { headers.Authorization = "Basic " + btoa(takeValue(i++, arg)); continue; }
    if (arg.startsWith("--user=")) { headers.Authorization = "Basic " + btoa(arg.slice(7)); continue; }
    if (arg === "--url") { url = takeValue(i++, arg); continue; }
    if (arg.startsWith("--url=")) { url = arg.slice(6); continue; }
    if (arg === "-G" || arg === "--get") { method = "GET"; continue; }
    if (arg === "-I" || arg === "--head") { method = "HEAD"; continue; }
    if (["-L", "--location", "-s", "--silent", "-S", "--show-error", "-k", "--insecure", "--compressed", "--globoff", "--http1.1", "--http2"].includes(arg)) continue;
    if (arg.startsWith("-")) throw new Error("Unsupported cURL option: " + arg);
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(arg)) { url = arg; continue; }
    throw new Error("Unexpected cURL argument: " + arg);
  }
  if (!url) throw new Error("No HTTP or HTTPS URL was found in the cURL command.");
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error("The cURL URL is invalid."); }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Only HTTP and HTTPS URLs are supported.");
  if (!method) method = hasBody ? "POST" : "GET";
  if (!["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(method)) throw new Error("Unsupported HTTP method: " + method);
  return { method, url: parsed.toString(), headers, body };
}

/** Format XML for readable inspection without changing its document content. */
export function prettyXml(source: string): string {
  const input = source.trim();
  if (!input) return "";
  const tokens = input.match(/<!--[\\s\\S]*?-->|<!\\[CDATA\\[[\\s\\S]*?\\]\\]>|<\\?[\\s\\S]*?\\?>|<!DOCTYPE[^>]*>|<[^>]+>|[^<]+/gi);
  if (!tokens) throw new Error("The XML response could not be formatted.");
  const lines: string[] = [];
  const stack: string[] = [];
  const indent = () => "  ".repeat(stack.length);
  for (const token of tokens) {
    const value = token.trim();
    if (!value) continue;
    if (/^<\\//.test(value)) {
      const name = value.match(/^<\\/\\s*([^\\s>]+)/)?.[1];
      if (!name || stack[stack.length - 1] !== name) throw new Error("The XML response contains mismatched closing tags.");
      stack.pop();
      lines.push(indent() + value);
    } else if (/^<[^!?][^>]*\\/>$/.test(value)) {
      lines.push(indent() + value);
    } else if (/^<[^!?][^>]*>$/.test(value)) {
      lines.push(indent() + value);
      const name = value.match(/^<\\s*([^\\s/>]+)/)?.[1];
      if (name) stack.push(name);
    } else if (/^<\\?|^<!/.test(value)) {
      lines.push(indent() + value);
    } else {
      lines.push(indent() + value);
    }
  }
  if (stack.length) throw new Error("The XML response contains unclosed tags.");
  return lines.join("\\n");
}
