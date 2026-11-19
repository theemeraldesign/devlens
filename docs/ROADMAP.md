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
- [ ] Cancel in-flight requests and resend requests.
- [ ] Multipart form data and URL-encoded body editors.
- [ ] Environment variable interpolation.
- [ ] Persist and search request history.
- [ ] Collection rename, delete, duplicate and export/import.

## Developer utilities
- [x] JSON formatter.
- [x] JSON diff.
- [x] JWT decoder with explicit no-signature-verification warning.
- [x] Base64 and URL encode/decode.
- [x] UUID generator.
- [x] cURL exporter.
- [ ] cURL importer.
- [ ] XML formatter and validator.

## Accounts and sharing
- [x] Email/password authentication.
- [x] Guest-to-account import flow.
- [ ] Cloud collection CRUD and cross-device sync.
- [ ] Private environment CRUD.
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
