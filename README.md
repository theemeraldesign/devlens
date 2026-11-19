# DevLens

> See your APIs clearly.

DevLens is an open-source API development studio for building requests, inspecting responses, organizing collections, and working with environments.

## Current build

The first application foundation is in place:
- Responsive request studio with seven HTTP methods.
- Query parameters, editable headers, JSON/text/URL-encoded request bodies and authentication.
- Response status, duration, size, pretty/raw body and response headers.
- Guest collections, saved requests, private environments and request history stored in the browser.
- Environment variable interpolation in URLs, headers, query parameters and request bodies.
- Email/password account flow through Supabase Auth, with cloud collection, environment and redacted request-history sync.
- Guest-to-account collection and environment import. Local copies are retained after import.
- Collection JSON import/export with credential header and URL-query redaction on import.
- Redacted request history stored locally for guests and synced to the signed-in account.
- Initial developer utilities: JSON formatting, JWT decoding, Base64, URL encoding, UUID generation and cURL export helpers.
- Cloudflare Worker API proxy with request/response size limits, timeouts, redirect blocking and public-address checks.
- Supabase schema with owner-scoped RLS for private data and a separate public snapshot surface.

This is an early development build. Some controls and advanced utilities are still being connected. The request proxy's DNS validation is a first security layer, not a substitute for a dedicated, DNS-pinned egress gateway. Do not deploy it for public production traffic until the egress design receives a full SSRF review.

## Stack

- React, Vite, TypeScript
- Tailwind CSS
- Cloudflare Workers and Static Assets
- Supabase Auth and PostgreSQL
- Vitest and Playwright

## Local development

Requirements: Node.js 22.12+

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set the Supabase project URL and publishable key in `.env.local`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

The publishable key is designed for client-side use. Never expose a Supabase secret/service-role key in browser code.

## Checks

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

## Database

Migrations live in `supabase/migrations`. The initial schema is applied to the dedicated DevLens Supabase project. All private tables have RLS enabled. Public visitors only receive the restricted `public_collections` view. Anonymous clients cannot write public snapshots or read owner and collection IDs.

## Deployment

Cloudflare Worker configuration lives in `wrangler.jsonc`. Production deployment is intentionally gated on build verification, environment configuration and a complete SSRF/egress security review.

## License

MIT
