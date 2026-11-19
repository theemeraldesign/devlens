# Security model and release gates

## Data classification

| Data | Guest mode | Signed-in mode | Public |
| --- | --- | --- | --- |
| Request definitions | Browser storage | Owner-only collection rows | Sanitized snapshot only |
| Environment values | Not cloud-synced | Owner-only | Never |
| Request history | Browser memory in this build | Owner-only table | Never |
| Auth credentials | Entered per request | Entered per request | Never |
| Account identity | Not required | Supabase Auth | Never included in snapshots |

## Current protections

- Supabase secret/service-role keys are not included in the frontend.
- RLS is enabled on every DevLens application table.
- Private collections, environments and history have owner-scoped policies.
- Anonymous database access is restricted to published snapshot fields.
- Public snapshots use a restricted invoker view. Owner and collection IDs are not exposed to anonymous clients.
- The Worker rejects non-HTTP(S) URLs, private IP literals, private DNS answers, credentials embedded in URLs and upstream redirects.
- The Worker streams and caps request and response bodies, caps header count and size, and applies a timeout.
- A Cloudflare Rate Limiting binding applies an approximate per-location limit of 60 proxy calls per minute per browser identity and source IP. This is a burst-control layer, not a strict global quota.
- JWT inspection is decode-only. It does not claim to verify signatures.

## Production release blockers

1. Replace the current DNS check plus independent fetch resolution with a DNS-pinned egress gateway or equivalent control that prevents DNS rebinding and private-address routing at connection time.
2. Add automated tests for URL parsing, IPv4/IPv6 special ranges, DNS answers, redirect handling, body limits, timeout behavior and rate-limit responses.
3. Validate request authentication and public collection sanitization on the server, not only in browser code.
4. Add abuse monitoring, retention limits and a clear acceptable-use policy for the public request proxy.
5. Review Cloudflare account-level egress controls and confirm the proxy cannot reach private, link-local, metadata or internal services.

Do not expose the current proxy to unrestricted public production traffic until these gates are closed.
