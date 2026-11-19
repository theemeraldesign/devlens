# Architecture

## Runtime

DevLens is a React + Vite + TypeScript single-page application served as Cloudflare Worker Static Assets. The Worker owns the same-origin API routes. Supabase provides account authentication and PostgreSQL persistence.

```text
Browser
  ├── Guest workspace ── localStorage
  ├── Supabase Auth ──── Supabase Auth API
  └── /api/proxy ─────── Cloudflare Worker
                           ├── destination validation
                           ├── rate limiting
                           └── upstream HTTP API
Supabase PostgreSQL
  ├── collections
  ├── environments
  ├── request_history
  └── public_collection_snapshots
       └── public_collections (restricted read view)
```

## Guest and account data

Guest collections are stored under the versioned browser key `devlens.guest.v1`. Creating an account does not erase guest data. The user explicitly chooses when to import it. A successful import leaves the local copy in place.

Authenticated data is owned by `auth.users.id`. Collections, environments and request history use owner-scoped RLS policies. Public collection snapshots are separate from private collection content.

## Public collection surface

The database exposes `public_collections`, a view containing only `slug`, `title`, `snapshot` and `published_at`. The view runs with invoker permissions. Anonymous access receives column-level SELECT rights to those same safe fields on the underlying snapshot table. Anonymous users cannot read owner IDs or collection IDs.

Publishing is not enabled in the current UI. Before it is implemented, the Worker must sanitize collection content server-side and reject credentials, secret variables, personal data and request history.

## Request execution

The browser sends a same-origin POST to `/api/proxy`. The Worker validates the method and URL, checks DNS A/AAAA answers for non-public destinations, enforces body and response limits, applies a per-browser rate limit, blocks redirects and applies a timeout.

The current DNS validation is not DNS-pinned. The upstream fetch performs its own resolution, so a DNS rebinding race remains possible. A dedicated egress design that pins the validated destination is a production release requirement.
