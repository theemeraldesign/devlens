# Roadmap

## Release foundation
- [x] Public landing page with responsive product preview and motion.
- [x] Reduced-motion support.
- [x] Account-required workspace access. No guest workspace entry.
- [x] Email/password sign-up and sign-in.
- [x] Password reset email and password update flow.
- [x] Legacy local workspace data import for existing users.
- [x] Supabase owner-scoped RLS and restricted public snapshot view.
- [x] CI and Cloudflare deployment workflows.
- [ ] Verify the current release commit through CI, production deployment, and live browser checks.
- [ ] Add authenticated production-like Playwright credentials to CI for full account-backed regression coverage.

## Request studio
- [x] Seven HTTP methods.
- [x] URL, query parameters, headers, request body editor, and request authentication.
- [x] JSON, text, URL-encoded, and multipart form-data text fields.
- [x] Multipart file selection and browser upload, with a 10 MB total limit.
- [x] Response status, timing, size, body, and headers.
- [x] JSON formatting and XML indentation in the response inspector.
- [x] Response downloads as JSON, XML, or text.
- [x] Cancel and resend requests.
- [x] Environment variable interpolation.
- [x] Request history with redaction, search, account sync, and clearing.
- [x] Collection create, rename, duplicate, delete, import, and export.

## Developer utilities
- [x] JSON formatter and diff.
- [x] JWT decoder with explicit no-signature-verification warning.
- [x] Base64 and URL encode/decode.
- [x] UUID generator.
- [x] cURL import/export with shell-input safeguards.
- [ ] Dedicated XML formatter and validator utility.

## Accounts, sync, and sharing
- [x] Supabase email/password authentication.
- [x] Password recovery and update.
- [x] Account-only access to the workspace.
- [x] Cloud collection create/save and cross-device loading.
- [x] Private environment CRUD and cross-device sync.
- [x] Redacted request-history sync.
- [x] Public collection publishing with server-side sanitisation.
- [x] Public shared collection viewing, account-required import, and unpublish.
- [ ] Full sync conflict resolution and offline queue handling.
- [ ] End-to-end verification against a dedicated test account.

## Security release blocker
- [x] Owner-scoped database policies and restricted public snapshots.
- [x] Request/response size limits, timeout controls, redirect restrictions, and public-address checks in the Worker.
- [ ] Implement DNS-pinned outbound egress. Current proxy remains disabled.
- [ ] Add adversarial SSRF tests for IPv4, IPv6, DNS rebinding, redirects, metadata endpoints, and alternate IP encodings.
- [ ] Enable server-side proxy only after independent security review.

## Later releases
- OpenAPI import.
- Collection runner and assertions.
- Request chaining.
- API documentation generation.
- WebSocket and GraphQL support.
- Team collaboration.
- CLI companion.
