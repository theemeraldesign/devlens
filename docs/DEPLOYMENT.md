# Production deployment

The production release is driven by GitHub Actions on pushes to `main`. The workflow runs typecheck, unit tests, production build, live browser checks, and authenticated end-to-end tests before the release is considered complete.

## Services

| Service | Host | Source |
| --- | --- | --- |
| Web app and Worker | Cloudflare | `wrangler.jsonc` |
| Secure egress gateway | Vercel | `gateway/` |
| Auth and database | Supabase | `supabase/` |

## GitHub Actions secrets

Configure these under repository Settings → Secrets and variables → Actions:

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Scoped token for deploying Workers and reading account settings |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Projects Account ID |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase browser publishable key |
| `DEVLENS_E2E_EMAIL` | Dedicated, confirmed test account |
| `DEVLENS_E2E_PASSWORD` | Dedicated test account password |

Do not add a Supabase secret or service-role key to GitHub Actions or the browser build. The publishing Edge Function uses the service-role key supplied by Supabase's managed runtime. Keep the E2E account separate from your personal account.

## Gateway environment

The Vercel project is `devlens-egress`. Set `DEVLENS_EGRESS_SECRET` in its Production environment. The Cloudflare Worker must have the matching `EGRESS_SHARED_SECRET` secret. Never put either value in source control or the frontend.

The Worker configuration supplies:

- `PROXY_EGRESS_ENABLED=true`
- `SUPABASE_URL` and the browser-safe publishable key
- `EGRESS_GATEWAY_URL=https://devlens-egress.vercel.app/api/proxy`
- Request, response and timeout limits

The Vercel gateway uses Node.js 22.x. Keep it on a patched release, currently Node.js 22.23.4 or later in the 22.x line. The gateway also disables Brotli response decoding as defence in depth.

## Supabase Auth URL configuration

In Supabase Dashboard → Authentication → URL Configuration:

- Set Site URL to `https://devlens.cc.cd`.
- Add the exact production redirect `https://devlens.cc.cd/?password-reset=1`.
- Add `https://devlens.cc.cd/` for the site root.
- For local development, add `http://localhost:5173/**`.

The password recovery flow depends on the redirect URL being on the allow list. If you customise the recovery email template, make sure it honours the supplied redirect destination.

## Production email delivery

Supabase's default SMTP service is for development only. It sends only to authorised team addresses and has a low sending limit. Production SMTP remains pending Brevo sender-domain verification and authenticated SMTP credentials. After verification, configure Supabase custom SMTP, confirm SPF/DKIM/DMARC, then test account confirmation and password recovery. Keep email confirmation enabled. Do not treat production email delivery as complete before those tests pass.

## Deploy and verify

1. Push reviewed changes to `main`.
2. GitHub Actions runs CI and the Cloudflare deployment workflow.
3. The deployment workflow builds and deploys the Worker and static assets.
4. It probes the production app routes and the Vercel gateway.
5. It installs Chromium and runs authenticated Playwright tests against `https://devlens.cc.cd`.
6. Confirm both the CI and deployment workflow runs are green.

The Vercel Git integration deploys the gateway from the same repository. Confirm its latest Production deployment is Ready after gateway changes.

## Rollback

- Cloudflare Worker: use the Workers Versions/Deployments history to roll back to the last known-good version.
- Vercel gateway: promote the previous Ready production deployment.
- GitHub: revert the offending commit, then allow the normal CI and deployment workflows to run.

Never roll back only one side of a Worker/gateway protocol change. Keep the Worker and gateway compatible.
