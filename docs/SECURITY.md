# Security model and release gates

## Data classification

| Data | Guest mode | Signed-in mode | Public |
| --- | --- | --- | --- |
| Request definitions | Browser storage | Owner-only collection rows | Sanitized snapshot only |
| Environment values | Not cloud-synced | Owner-only | Never |
| Request history | Browser storage | Owner-only table, URL query secrets redacted | Never |
| Auth credentials | Entered per request | Entered per request | Never |
| Account identity | Not required | Supabase Auth | Never included in snapshots |

## Current protections

- Supabase secret/service-role keys are not included in the frontend.
- RLS is enabled on every DevLens application table.
- Private collections, environments and history have owner-scoped policies.
- Anonymous database access is restricted to published snapshot fields.
- Public snapshots use a restricted invoker view. Owner and collection IDs are not exposed to anonymous clients. Browser clients cannot write public snapshots; publishing must go through a trusted service that sanitizes content server-side.
- The Worker rejects non-HTTP(S) URLs, private IP literals, private DNS answers, credentials embedded in URLs and upstream redirects.
- The Worker streams and caps request and response bodies, caps header count and size, and applies a timeout.
- A Cloudflare Rate Limiting binding applies an approximate per-location limit of 60 proxy calls per minute per source IP. The key is derived from Cloudflare's platform-provided client IP, not a client-controlled identifier. This is a burst-control layer, not a strict global quota.
- Public snapshots redact credential-like URL query values, remove sensitive JSON fields from request bodies, and omit non-JSON request bodies.
- Request history stores method, redacted URL, status and duration only. It does not store request or response bodies or credential headers.
- JWT inspection is decode-only. It does not claim to verify signatures.

## Egress investigation

Cloudflare documents Workers VPC with a `cf1:network` binding as a way to route Worker-originated public Internet traffic through Cloudflare Gateway. Gateway DNS, HTTP and Network policies then apply to the request.

Workers VPC is currently in beta and documented as free on Workers plans. Its VPC Network configuration requires at least one active Cloudflare Tunnel, Cloudflare Mesh node or Cloudflare WAN on-ramp. The Projects Account currently has no Cloudflare Tunnels and no Gateway rules configured. The Gateway egress path is therefore not provisioned or tested.

The VPC option is promising, but it is not a completed security control until an always-on network on-ramp exists, explicit Gateway Network policies block private and special-purpose IPv4/IPv6 destinations, and tests confirm those policies apply to Worker egress.

## Production release blockers

1. Replace the current DNS check plus independent fetch resolution with a DNS-pinned egress gateway or equivalent control that prevents DNS rebinding and private-address routing at connection time. A Cloudflare Workers VPC + Gateway design is under evaluation; it is not enabled yet.
2. Extend automated tests for URL parsing, IPv4/IPv6 special ranges, DNS answers and rebinding, redirect handling, body limits, timeout behavior and rate-limit responses. The current suite covers the IP classifier and multipart body construction.
3. Validate request authentication and public collection sanitization on the server, not only in browser code.
4. Add abuse monitoring, retention limits and a clear acceptable-use policy for the public request proxy.
5. Review Cloudflare account-level egress controls and confirm the proxy cannot reach private, link-local, metadata or internal services.

Do not expose the current proxy to unrestricted public production traffic until these gates are closed.
