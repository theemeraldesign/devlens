# DevLens

> See your APIs clearly.

DevLens is an API development studio for composing HTTP requests, inspecting responses, organising collections, and managing environments.

## Product experience

- Public product landing page with a responsive workspace preview, reduced-motion support, feature overview, security notes, and footer.
- Account-required workspace. Sign up or sign in before accessing request tools.
- Supabase email/password authentication, password recovery, and password update.
- Private account collections, saved requests, environments, and redacted request history.
- Public, read-only collection links with server-side sanitisation, import, and unpublish.
- Legacy local workspace data import for users who created data before account-only access.

## Request studio

- Seven HTTP methods: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS.
- URL, query parameters, editable headers, request authentication, and JSON, text, URL-encoded, or multipart bodies.
- Multipart text fields and file attachments. Browser file uploads are limited to 10 MB total and require the target API to allow CORS.
- Response status, duration, size, headers, pretty/raw body, XML indentation, and JSON/XML/text downloads.
- Cancel and resend requests.
- Environment variable interpolation in URLs, headers, query parameters, and request bodies.

## Developer tools

- JSON formatting and diff, plus XML formatting that preserves mixed content.
- JWT header/payload inspection. Decoding does not verify signatures.
- Base64 and URL encode/decode.
- UUID generation.
- cURL import/export with shell operator and command substitution rejection.

## Network and security

Authenticated text-based API requests use the DevLens secure egress gateway. The Cloudflare Worker validates the Supabase session, applies per-IP and per-user rate limits, and signs the request envelope. A separate Vercel gateway verifies the HMAC signature and uses `guarded-fetch` for public-destination checks, DNS-rebinding-resistant connection pinning, request-header sanitisation, and redirect blocking.

The gateway caps request bodies at 2 MB, response bodies at 5 MB, and request duration at 20 seconds. Response cookies are not returned to the browser. The gateway rejects private, loopback, link-local, metadata, and reserved network destinations. It blocks redirects; send the request to the final destination directly.

Multipart file uploads stay in the browser because browser File objects are not sent through the JSON gateway. Those uploads require the target API to allow CORS from the DevLens origin.

DevLens does not store API credentials in public collection snapshots. Request history stores redacted metadata, not request or response bodies.

## Stack

- React, Vite, TypeScript
- Tailwind CSS
- Cloudflare Workers and Static Assets
- Vercel serverless egress gateway
- Supabase Auth and PostgreSQL
- Vitest and Playwright

## Local development

Requirements: Node.js 22.23.4 or later in the 22.x line.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set these values in `.env.local`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

The publishable key is designed for browser use. Never expose a Supabase secret or service-role key in client code.

## Checks

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Authenticated Playwright workspace tests require the GitHub Actions secrets `DEVLENS_E2E_EMAIL` and `DEVLENS_E2E_PASSWORD`, plus the two `VITE_SUPABASE_*` secrets. Use a dedicated, email-confirmed test account. Deployment also runs public checks and authenticated workspace tests against production.

The egress gateway has its own test suite:

```bash
cd gateway
npm install
npm test
```

## Database and sharing

Migrations live in `supabase/migrations`. Private tables use owner-scoped row-level security. Public visitors receive only the restricted `public_collections` view. Publishing runs through an authenticated Supabase Edge Function with server-side sanitisation. See [sharing security](docs/SHARING.md).

## Deployment

Cloudflare Worker configuration lives in `wrangler.jsonc`. GitHub Actions run typecheck, unit tests, production build, gateway tests, and Playwright checks before deployment. The Worker and static assets deploy to Cloudflare. The egress gateway deploys from the same repository to Vercel. See [deployment](docs/DEPLOYMENT.md) and [security](docs/SECURITY.md).

## Project documentation

- [Setup guide](docs/SETUP.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Security model](docs/SECURITY.md)
- [Public collection sharing](docs/SHARING.md)
- [Completion roadmap](docs/ROADMAP.md)
- [Production release record](docs/RELEASE.md)
- [Portfolio screenshot capture guide](docs/SCREENSHOTS.md)

## License

MIT
