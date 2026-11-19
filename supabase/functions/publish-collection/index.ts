import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const blockedHeader = /^(authorization|proxy-authorization|cookie|cookies|set-cookie|x-api-key|api[-_]?key|apikey|password|secret|client[-_]?secret|x-auth-token|token)$/i;
const secretQuery = /^(key|api[-_]?key|apikey|x[-_]?api[-_]?key|token|access[-_]?token|refresh[-_]?token|x[-_]?auth[-_]?token|password|secret|client[-_]?secret|authorization|auth|session)$/i;

function publicUrl(source: string): string {
  try {
    const url = new URL(source);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    url.username = "";
    url.password = "";
    for (const key of [...url.searchParams.keys()]) {
      if (secretQuery.test(key)) url.searchParams.set(key, "[REDACTED]");
    }
    return url.toString();
  } catch {
    return "";
  }
}

function publicBody(source: unknown): string {
  if (typeof source !== "string" || source.length > 100_000) return "";
  try {
    const parsed = JSON.parse(source);
    const clean = sanitizeJson(parsed);
    return JSON.stringify(clean);
  } catch {
    return "";
  }
}

function sanitizeJson(value: unknown): unknown {
  const blockedKey = /authorization|cookie|token|secret|password|credential|api[-_]?key|apikey|environment|history|owner_id|collection_id|user_id|email|username|profile|account/i;
  if (Array.isArray(value)) return value.filter((item) => {
    if (!item || typeof item !== "object") return true;
    const row = item as Record<string, unknown>;
    const label = String(row.key ?? row.name ?? "");
    return !blockedKey.test(label);
  }).map(sanitizeJson);
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (blockedKey.test(key)) continue;
    if (key.toLowerCase() === "url" && typeof child === "string") {
      output[key] = publicUrl(child);
      continue;
    }
    output[key] = sanitizeJson(child);
  }
  return output;
}

function sanitizeRequest(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
  const method = String(row.method || "GET").toUpperCase();
  const url = typeof row.url === "string" ? publicUrl(row.url) : "";
  if (!methods.includes(method) || !url) return null;
  const headers = Array.isArray(row.headers)
    ? row.headers.filter((item) => item && typeof item === "object").map((item) => item as Record<string, unknown>)
      .filter((item) => {
        const key = String(item.key || item.name || "");
        return key.length > 0 && !blockedHeader.test(key) && !/token|secret|password|credential|api[-_]?key/i.test(key);
      })
      .slice(0, 60)
      .map((item) => ({ key: String(item.key || item.name).slice(0, 128), value: String(item.value || "").slice(0, 8192), enabled: item.enabled !== false }))
    : [];
  return {
    name: typeof row.name === "string" ? row.name.slice(0, 120) : "API request",
    method,
    url,
    headers,
    body: publicBody(row.body),
    bodyType: row.bodyType === "text" || row.bodyType === "urlencoded" ? row.bodyType : "json"
  };
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return Response.json({ error: "Method not allowed." }, { status: 405, headers: corsHeaders });

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return Response.json({ error: "Sign in to publish a collection." }, { status: 401, headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return Response.json({ error: "Publishing service is not configured." }, { status: 503, headers: corsHeaders });

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return Response.json({ error: "Your session is invalid. Sign in again." }, { status: 401, headers: corsHeaders });

  let payload: { collectionId?: string; action?: string };
  try { payload = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400, headers: corsHeaders }); }
  if (!payload.collectionId || !/^[0-9a-f-]{36}$/i.test(payload.collectionId)) return Response.json({ error: "A valid collection ID is required." }, { status: 400, headers: corsHeaders });

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  if (payload.action === "status") {
    const { data: existing, error } = await admin.from("public_collection_snapshots")
      .select("slug").eq("collection_id", payload.collectionId).eq("owner_id", authData.user.id).maybeSingle();
    if (error) return Response.json({ error: "Unable to check publication status." }, { status: 500, headers: corsHeaders });
    return Response.json({ published: Boolean(existing), slug: existing?.slug ?? null }, { headers: corsHeaders });
  }

  if (payload.action === "unpublish") {
    const { error } = await admin.from("public_collection_snapshots").delete().eq("collection_id", payload.collectionId).eq("owner_id", authData.user.id);
    if (error) return Response.json({ error: "Unable to unpublish this collection." }, { status: 500, headers: corsHeaders });
    return Response.json({ published: false }, { headers: corsHeaders });
  }

  const { data: collection, error: collectionError } = await userClient.from("collections")
    .select("id,name,content").eq("id", payload.collectionId).eq("owner_id", authData.user.id).maybeSingle();
  if (collectionError || !collection) return Response.json({ error: "Collection not found or access denied." }, { status: 404, headers: corsHeaders });

  const content = collection.content && typeof collection.content === "object" ? collection.content as Record<string, unknown> : {};
  const sourceRequests = Array.isArray(content.requests) ? content.requests : [];
  if (sourceRequests.length > 500) return Response.json({ error: "Collections are limited to 500 requests for publishing." }, { status: 400, headers: corsHeaders });
  const requests = sourceRequests.map(sanitizeRequest).filter((item): item is Record<string, unknown> => item !== null);
  const { data: existing } = await admin.from("public_collection_snapshots").select("slug").eq("collection_id", collection.id).eq("owner_id", authData.user.id).maybeSingle();
  const slug = existing?.slug || crypto.randomUUID().replace(/-/g, "");
  const snapshot = { format: "devlens-public-collection", version: 1, requests };
  const { data: published, error: publishError } = await admin.from("public_collection_snapshots").upsert({
    collection_id: collection.id,
    owner_id: authData.user.id,
    slug,
    title: String(collection.name).slice(0, 120),
    snapshot,
    published_at: new Date().toISOString()
  }, { onConflict: "collection_id" }).select("slug").single();

  if (publishError || !published) return Response.json({ error: "Unable to publish this collection." }, { status: 500, headers: corsHeaders });
  return Response.json({ published: true, slug: published.slug, title: collection.name, requestCount: requests.length }, { headers: corsHeaders });
});
