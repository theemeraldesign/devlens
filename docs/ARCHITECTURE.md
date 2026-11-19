# DevLens architecture

## Product boundary

DevLens is an account-based API workspace. Visitors see the public landing page. Registration and sign-in use Supabase Auth. The request workspace is available after authentication.

Legacy guest collections and environments remain in browser storage under versioned keys. After sign-in, DevLens offers an explicit import. It does not silently upload local data.

## Runtime topology

```text
Browser
  ├── Public landing page
  ├── Supabase Auth
  ├── Account workspace
  │    ├── Collections and saved requests
  │    ├── Environments
  │    ├── Redacted request history
  │    └── Local legacy-data import
  └── POST /api/proxy
         │
         ▼
Cloudflare Worker
  ├── Supabase access-token validation
  ├── Per-IP and per-user rate limits
  ├── Request validation and size limits
  └── Timestamped HMAC-SHA256 envelope
         │
         ▼
Vercel egress gateway
  ├── HMAC and timestamp verification
  ├── guarded-fetch public-destination checks
  ├── DNS preflight and connection-time IP pinning
  ├── Header sanitisation and redirect blocking
  └── Bounded upstream response
         │
         ▼
External HTTP API

Supabase
  ├── Auth
  ├── collections
  ├── environments
  ├── request_history
  ├── public_collection_snapshots
  └── public_collections (restricted read view)
```

## Workspace persistence

- Collections and saved requests belong to the authenticated owner.
- Environments belong to the authenticated owner. Variable values are stored in the private database row and are never included in public snapshots.
- Request history stores method, redacted URL, status, duration and timestamp. It does not store request or response bodies or credential headers.
- Row-level security is enabled on every DevLens application table. Owner policies scope private rows to the signed-in user.
- Legacy browser data remains local until the user explicitly imports it.

## Public collection sharing

Publishing runs through the authenticated `publish-collection` Supabase Edge Function. It reads the owner's collection through the caller's RLS-scoped client, sanitises the content server-side, and writes a separate public snapshot using the Edge Function's managed service-role client.

Public visitors read the restricted `public_collections` view. The view exposes only the share slug, title, sanitised snapshot and publication timestamp. It uses invoker permissions. Anonymous users cannot read owner IDs, collection IDs, private environments or history. Unpublishing deletes the snapshot and disables the old link.

See [sharing security](SHARING.md).

## Request execution and egress security

The browser sends text-based requests to the same-origin Cloudflare Worker endpoint, `/api/proxy`. The Worker validates the Supabase session against Supabase Auth, applies rate limits by platform client IP and verified user ID, validates the request envelope, then signs it with HMAC-SHA256 and a short-lived timestamp.

The separate Vercel gateway verifies the signature and timestamp. It uses the pinned `guarded-fetch` transport for DNS preflight checks and connection-time IP pinning. Private, loopback, link-local, CGNAT, metadata, reserved and unsafe IPv6 destinations are rejected. Redirects are blocked rather than followed. Request headers are sanitised, response cookies are stripped, and request/response sizes and execution time are bounded.

Current limits:

- Worker request body: 1 MB.
- Gateway request body: 2 MB.
- Upstream response body: 5 MB.
- Upstream response headers: 60 entries and 16 KB.
- Request timeout: 20 seconds.
- Multipart file attachments: browser mode, 10 MB total. The destination API must allow CORS from the DevLens origin.

The browser upload path is intentionally separate because File objects are not sent through the JSON gateway. It does not bypass the target API's CORS policy.

## Client and deployment

- React, Vite and TypeScript serve the application.
- Cloudflare Worker Static Assets host the web app and same-origin Worker routes.
- Vercel hosts the dedicated outbound egress gateway.
- Supabase provides authentication, PostgreSQL and the collection-publishing Edge Function.
- GitHub Actions run typecheck, unit tests, build, gateway tests and Playwright checks. The deployment workflow deploys Cloudflare assets and verifies the production application and authenticated workspace.

See [setup](SETUP.md), [deployment](DEPLOYMENT.md) and [security](SECURITY.md).
