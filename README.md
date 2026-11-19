# DevLens

> See your APIs clearly.

DevLens is an open-source API development studio for composing HTTP requests, inspecting responses, organising collections, and managing environments.

## Product experience

- Public product landing page with a responsive workspace preview, first-load motion, reduced-motion support, feature overview, security notes, and split ASCII-light footer.
- Account-required workspace. Visitors sign up or sign in before accessing request tools.
- Supabase email/password authentication, password recovery, and password update.
- Private account collections, saved requests, environments, and redacted request history.
- Public, read-only collection links with server-side sanitisation, import, and unpublish.
- Legacy local workspace data import for users who created data before account-only access was introduced.

## Request studio

- Seven HTTP methods: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS.
- URL, query parameters, editable headers, request authentication, and JSON, text, URL-encoded, or multipart bodies.
- Multipart text fields and file attachments. Browser uploads are limited to 10 MB total and are not saved with collections.
- Response status, duration, size, headers, pretty/raw body, XML indentation, and JSON/XML/text downloads.
- Cancel and resend requests.
- Environment variable interpolation in URLs, headers, query parameters, and request bodies.

## Developer tools

- JSON formatting and diff.
- JWT header/payload inspection. Decoding does not verify signatures.
- Base64 and URL encode/decode.
- UUID generation.
- cURL import/export with shell operator and command substitution rejection.

## Network and security status

The Worker API proxy remains disabled. DevLens currently uses direct browser requests when the proxy reports that it is disabled. This works only when the target API permits CORS from the DevLens origin. Multipart file uploads use the same browser path because the current JSON proxy transport does not carry browser File objects.

The Worker includes request/response limits, timeout controls, redirect restrictions, and public-address checks. Those checks are not a complete DNS-pinned egress design. Do not enable public server-side proxy traffic until the egress implementation has passed a dedicated SSRF review and adversarial tests. DevLens does not claim that APIs blocking browser CORS are supported yet.

## Stack

- React, Vite, TypeScript
- Tailwind CSS
- Cloudflare Workers and Static Assets
- Supabase Auth and PostgreSQL
- Vitest and Playwright

## Local development

Requirements: Node.js 22.12+.

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

Authenticated Playwright workspace tests require `DEVLENS_E2E_EMAIL` and `DEVLENS_E2E_PASSWORD`. Public landing, sign-in entry, password recovery entry, reduced-motion, and signed-out route tests run without a test account.

## Database and sharing

Migrations live in `supabase/migrations`. Private tables use owner-scoped row-level security. Public visitors receive only the restricted `public_collections` view. Publishing runs through an authenticated Supabase Edge Function with server-side sanitisation. See [sharing security](docs/SHARING.md).

## Deployment

Cloudflare Worker configuration lives in `wrangler.jsonc`. GitHub Actions run typecheck, unit tests, production build, and Playwright checks before deployment. Production proxy traffic remains disabled pending secure egress review. See [deployment](docs/DEPLOYMENT.md) and [security](docs/SECURITY.md).

## License

MIT
