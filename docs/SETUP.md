# DevLens setup guide

## Requirements

- Node.js 22.23.4 or later in the 22.x line.
- npm.
- A Supabase project for authentication and database-backed workspace sync.

## Local application

1. Clone the repository:

   ```bash
   git clone https://github.com/theemeraldesign/devlens.git
   cd devlens
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a local environment file.

   macOS/Linux:

   ```bash
   cp .env.example .env.local
   ```

   Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env.local
   ```

4. Set the browser-safe Supabase values in `.env.local`:

   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`

   Never put a Supabase secret or service-role key in a Vite variable. Vite variables are exposed to the browser bundle.

5. Start the app:

   ```bash
   npm run dev
   ```

Vite prints the local development URL, normally `http://localhost:5173`.

## Supabase project setup

The production project uses the Supabase project reference `ufptcrhuibihwzjbjhqc`.

For a separate development project:

1. Install and authenticate the Supabase CLI.
2. Link the repository to the development project.
3. Review the migrations in `supabase/migrations` before applying them.
4. Apply the migrations to the development project.
5. Deploy the `publish-collection` Edge Function.
6. Configure the Auth Site URL and allowed redirect URLs for the local and deployed app origins.
7. Keep email confirmation enabled and configure a verified SMTP provider before relying on production confirmation or recovery emails.

The production database currently has all ten repository migrations applied. Do not run schema changes against production without reviewing the SQL and the target project first.

## Checks

Run the application checks from the repository root:

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Authenticated Playwright tests use a dedicated, confirmed test account. Set:

- `DEVLENS_E2E_EMAIL`
- `DEVLENS_E2E_PASSWORD`

To run the browser suite against a deployed site, also set `PLAYWRIGHT_BASE_URL` to that site's origin.

The secure egress gateway has a separate test suite:

```bash
cd gateway
npm install
npm test
```

## Production services

| Service | Responsibility |
|---|---|
| Cloudflare Worker and Static Assets | Application hosting and same-origin API route |
| Vercel `devlens-egress` | Signed, SSRF-protected outbound HTTP requests |
| Supabase | Auth, PostgreSQL and collection publishing |
| GitHub Actions | CI, production checks and Cloudflare deployment |

See [architecture](ARCHITECTURE.md), [deployment](DEPLOYMENT.md) and [security](SECURITY.md) for system details.
