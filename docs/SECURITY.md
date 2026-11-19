# Security model

## Data classification

| Data | Signed-in mode | Public |
| --- | --- | --- |
| Request definitions | Owner-only collection rows | Sanitised snapshot only |
| Environment values | Owner-only | Never |
| Request history | Owner-only, URL query secrets redacted | Never |
| Auth credentials | Entered per request | Never |
| Account identity | Supabase Auth | Never included in snapshots |

## Request path

1. The browser sends an API request and the user's Supabase access token to the Cloudflare Worker.
2. The Worker validates the token through Supabase Auth. It rejects unauthenticated requests.
3. Cloudflare rate limits requests by the platform-provided client IP and verified Supabase user ID.
4. The Worker validates the URL and request envelope, then signs the envelope with HMAC-SHA256 and a short-lived timestamp.
5. The Vercel gateway verifies the HMAC signature and timestamp before accepting the request.
6. The gateway uses the pinned `guarded-fetch` 0.3.0 dependency. Its default dispatcher performs DNS preflight checks and connect-time IP pinning. This prevents a DNS answer from changing to a private address between validation and connection.
7. Redirect following is disabled. The Worker rejects 3xx upstream responses and asks the user to request the final URL directly.

## Current protections

- Supabase secret/service-role keys are not included in the frontend.
- RLS is enabled on every DevLens application table.
- Private collections, environments and history have owner-scoped policies.
- Anonymous database access is restricted to published snapshot fields.
- Public snapshots use a restricted invoker view. Owner and collection IDs are not exposed to anonymous clients. Browser clients cannot write public snapshots; publishing goes through an authenticated Edge Function that sanitises content server-side.
- The Worker accepts only HTTP(S) URLs and rejects private IP literals, credentials embedded in URLs, and local hostnames.
- The gateway's guarded transport rejects private, loopback, link-local, CGNAT, metadata, reserved, and unsafe IPv6-embedded destinations. It validates every DNS answer and pins the validated address at connection time.
- The gateway strips unsafe request headers, including Host, Cookie, forwarding, proxy, and cloud-metadata headers.
- The gateway blocks redirects and strips response cookies.
- The Worker applies approximate limits of 60 requests per minute per source IP and per verified user.
- Worker request bodies are capped at 1 MB. Gateway request bodies are capped at 2 MB. Upstream response bodies are capped at 5 MB.
- Upstream response headers are capped at 60 entries and 16 KB. Response cookies are omitted.
- Requests time out after 20 seconds.
- Brotli response decoding is disabled in the gateway as defence in depth against CVE-2026-111497.
- Public snapshots redact credential-like URL query values, remove sensitive JSON fields from request bodies, and omit non-JSON request bodies.
- Request history stores method, redacted URL, status and duration only. It does not store request or response bodies or credential headers.
- JWT inspection is decode-only. It does not claim to verify signatures.

## Runtime hardening

The Vercel gateway project is configured for Node.js 22.x. The gateway package and CI workflows require the patched 22.x release line, 22.23.4 or later. Keep the runtime on a patched supported Node.js release and update dependencies through reviewed changes.

## Remaining operational work

- Supabase's security advisor currently reports that leaked-password protection is disabled. Enable leaked-password protection in Supabase Auth password security settings.
- Configure and verify a production SMTP provider before broad public registration and password recovery. Keep email confirmation enabled.
- Add production alerting and a regular review of gateway abuse and rate-limit metrics.
- Expand automated integration tests with controlled DNS fixtures, rebinding simulations, and live gateway probes. Existing unit tests cover signature validation, request-envelope validation, representative private/public IP ranges, and bounded response headers.
- Review the gateway dependency and its security advisories during routine maintenance.

This is a layered application-level egress control. It is not a promise that arbitrary internet destinations are harmless. Users should only send requests to services they are authorised to access.
