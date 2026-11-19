# Cloudflare deployment

The production deployment workflow runs on pushes to `main` and can also be started manually. It runs typecheck, unit tests, a production build, and browser checks before deploying the Worker and static assets. It then runs the public browser checks against `https://devlens.cc.cd`.

## GitHub repository secrets

Add these under Settings → Secrets and variables → Actions:

| Secret | Value |
| --- | --- |
| CLOUDFLARE_API_TOKEN | A Cloudflare API token scoped to the Projects Account with Workers Scripts: Edit and Account Settings: Read. The Cloudflare dashboard's Edit Cloudflare Workers token template is another supported starting point; restrict its account scope. |
| CLOUDFLARE_ACCOUNT_ID | `c76cbb7dc13126491526912181cae743`. |
| VITE_SUPABASE_URL | `https://ufptcrhuibihwzjbjhqc.supabase.co`. |
| VITE_SUPABASE_PUBLISHABLE_KEY | The project's Supabase publishable key. Safe for browser use. |
| DEVLENS_E2E_EMAIL | Email for a dedicated, confirmed Supabase test account. |
| DEVLENS_E2E_PASSWORD | Password for that test account. |

Do not add a Supabase secret or service-role key to GitHub Actions or the browser build. The publishing Edge Function uses the service-role key supplied by Supabase's managed runtime. The CI workflow uses the VITE keys and optional test-account secrets to run account-backed workspace tests. Keep the test account separate from your personal account.

## Supabase Auth URL configuration

In Supabase Dashboard → Authentication → URL Configuration:

- Set Site URL to `https://devlens.cc.cd`.
- Add the exact production redirect `https://devlens.cc.cd/?password-reset=1`.
- Add `https://devlens.cc.cd/` for the site root.
- For local development, add `http://localhost:5173/**`.

The password recovery flow depends on the redirect URL being on the allow list. If you customise the recovery email template, make sure it honours the supplied redirect destination.

## Run deployment

1. Open the DevLens repository on GitHub.
2. Select Actions.
3. Select Deploy DevLens to Cloudflare.
4. Select Run workflow on the main branch. The workflow uses Cloudflare's current Wrangler Action v4.

The workflow stops before deployment if typecheck, unit tests or the production build fails. The Worker ships with `PROXY_EGRESS_ENABLED=false`, so the app can be deployed without exposing the unfinished outbound proxy.

## Production gate

Do not change `PROXY_EGRESS_ENABLED` to `true` until DNS-pinned outbound egress or an equivalent reviewed SSRF control is in place. The current Worker validates DNS answers and blocks redirects, but it cannot guarantee that the address used by the subsequent outbound fetch is the same address that was validated. See [the security review](SECURITY.md).
