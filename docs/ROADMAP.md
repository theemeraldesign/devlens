# Roadmap

## Foundation
- [x] Create the public GitHub repository.
- [x] Set up the dedicated Supabase project.
- [x] Establish React, Vite, TypeScript and Cloudflare Worker structure.
- [x] Build the initial responsive request studio.
- [x] Add guest collections and local request saving.
- [x] Add Supabase email sign-in and guest collection import.
- [x] Add initial RLS schema and restricted public snapshot view.
- [x] Add CI, Vitest and Playwright smoke-test definitions.
- [ ] Verify CI typecheck, tests and production build.
- [ ] Complete SSRF-safe outbound egress design.

## Request workspace
- [x] Seven HTTP methods.
- [x] URL, query parameters, headers and body editor.
- [x] Bearer, Basic and API-key request authentication.
- [x] Response status, timing, size, body and headers.
- [x] Cancel in-flight requests and resend requests.
- [x] JSON, text and URL-encoded body modes.
- [ ] Multipart form-data editor.
- [x] Environment variable interpolation.
- [x] Persist request history locally and sync it across devices.
- [x] Search and filter request history.
- [x] Clear local and account request history.
- [x] Collection JSON import/export.
- [x] Collection rename, delete and duplicate.

## Developer utilities
- [x] JSON formatter.
- [x] JSON diff.
- [x] JWT decoder with explicit no-signature-verification warning.
- [x] Base64 and URL encode/decode.
- [x] UUID generator.
- [x] cURL exporter.
- [x] cURL importer with shell-operator and command-substitution rejection.
- [ ] XML formatter and validator.

## Accounts and sharing
- [x] Email/password authentication.
- [x] Guest-to-account import flow.
- [x] Cloud collection create/save and cross-device loading.
- [x] Collection rename, delete and duplicate.
- [ ] Full sync conflict handling.
- [x] Private environment CRUD and cross-device sync.
- [ ] Public collection publishing with server-side sanitization.
- [ ] Public collection import into a workspace.

## Later releases
- OpenAPI import.
- Collection runner and assertions.
- Request chaining.
- API documentation generation.
- WebSocket and GraphQL support.
- Team collaboration.
- CLI companion.
