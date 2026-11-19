# Cloudflare deployment

The production deployment workflow is manual. It runs typecheck, unit tests and a production build before deploying the Worker and static assets.

## GitHub repository secrets

Add these under Settings → Secrets and variables → Actions:

| Secret | Value |
| --- | --- |
| CLOUDFLARE_API_TOKEN | A Cloudflare API token scoped to the Projects Account with Workers Scripts: Edit and Account Settings: Read. The Cloudflare dashboard's Edit Cloudflare Workers token template is another supported starting point; restrict its account scope. |
| CLOUDFLARE_ACCOUNT_ID | `c76cbb7dc13126491526912181cae743`. |
| VITE_SUPABASE_URL | `https://ufptcrhuibihwzjbjhqc.supabase.co`. |
| VITE_SUPABASE_PUBLISHABLE_KEY | `sb_publishable_TcMeVeYLosv7U-wM5WqlOw_D7-YuOGX` (publishable key, safe for browser use). |

Do not add a Supabase service-role key to GitHub Actions or the browser build. The publishing Edge Function uses the service-role key supplied by Supabase's managed runtime.

## Run deployment

1. Open the DevLens repository on GitHub.
2. Select Actions.
3. Select Deploy DevLens to Cloudflare.
4. Select Run workflow on the main branch. The workflow uses Cloudflare's current Wrangler Action v4.

The workflow stops before deployment if typecheck, unit tests or the production build fails.

## Production gate

Do not enable public API proxy traffic until DNS-pinned outbound egress or an equivalent reviewed SSRF control is in place. The current Worker validates DNS answers and blocks redirects, but it cannot guarantee that the address used by the subsequent outbound fetch is the same address that was validated.
