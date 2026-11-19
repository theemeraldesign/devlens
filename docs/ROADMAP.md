# DevLens completion roadmap

This file is the release acceptance checklist. It separates implemented product behavior from checks that still depend on external account configuration.

## Product and engineering checks

| Area | Status | Acceptance check |
|---|---|---|
| Authentication | Implemented | Registration, sign-in, sign-out, password recovery and password update are in the app. Browser tests cover the account entry and recovery screens. Production email delivery still depends on verified SMTP. |
| Cloud workspace | Implemented | Collections, saved requests, environments and redacted request history sync to owner-scoped Supabase tables. Collection and environment persistence are covered by authenticated browser checks. |
| Sharing | Implemented | Publish, open, import and unpublish use the authenticated Edge Function and restricted public read view. An end-to-end flow is included in the release checks. |
| Request studio | Implemented | HTTP methods, query parameters, headers, auth modes, JSON/text/url-encoded/form-data bodies, file selection, validation and cancellation are available. |
| Response inspector | Implemented | Pretty JSON/XML/text, raw body, response headers, copy and download are available. JSON/XML response inspection and downloads are covered by browser tests. |
| Utilities | Implemented | JSON formatter/diff, XML formatter, JWT inspector, Base64, URL encode/decode, UUID and cURL import/export have unit coverage. |
| Security | Implemented | Worker authentication and rate limiting, signed gateway envelopes, guarded outbound fetch, SSRF protections, redirect blocking, sanitisation and bounded payloads are in place. |
| Experience | In release checks | Responsive layouts, reduced-motion behavior, visible focus, modal keyboard handling and a workspace skip link are covered by browser checks. |
| Portfolio documentation | In progress | README, setup, architecture, deployment, security, sharing and release records are maintained. Real product screenshots still need to be captured and added. |

## External account work

- [ ] Verify the Brevo sender domain and SMTP credentials, then configure Supabase custom SMTP.
- [ ] Send and receive production confirmation and password-recovery emails after SMTP verification.

Supabase leaked-password protection is a known Free-plan limitation and is intentionally outside this completion pass.

## Portfolio screenshot capture

No real screenshots are committed yet. Capture the live product, not mockups, at these sizes:

- Desktop workspace: 1440 × 900.
- Mobile workspace: 390 × 844.
- Collections and environment screens.
- Public shared-collection page.
- Utilities and response inspector.

Keep credentials, tokens, private URLs and personal account data out of screenshots.

## Release rule

A green deployment alone does not complete the project. The acceptance checks must pass, external account dependencies must be stated clearly, and documentation must match the deployed architecture. Do not claim universal API compatibility. Multipart browser uploads still depend on the destination's CORS policy.
