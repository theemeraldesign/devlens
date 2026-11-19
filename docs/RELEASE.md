# DevLens production release record

## Release

- Product version: 0.1.0
- Production origin: https://devlens.cc.cd
- Source repository: https://github.com/theemeraldesign/devlens
- Production branch: `main`
- Release verification date: 19 November 2026
- Verified source commit: `555fb25574e1e7597b216640d3ee0e8abcb69e21`

## Included capabilities

- Supabase account registration, sign-in, sign-out and password recovery/update flows.
- Private collections, saved requests, environments and redacted request history.
- Public collection publishing, read-only share pages, import and unpublish.
- HTTP request composition, authentication helpers, query parameters and multiple body types.
- Multipart file selection with a 10 MB browser upload limit.
- Pretty/raw/headers response inspection, JSON/XML formatting and response downloads.
- JSON, XML, JWT, Base64, URL, UUID and cURL utilities.
- Cloudflare Worker to Vercel signed egress gateway with SSRF protections and bounded responses.
- Responsive desktop/mobile layouts, reduced-motion support and keyboard-accessible modal behavior.

## Production verification record

The latest release verification recorded:

- GitHub CI workflow: [run 44521866022](https://github.com/theemeraldesign/devlens/actions/runs/44521866022).
- Cloudflare deployment workflow: [run 44521866034](https://github.com/theemeraldesign/devlens/actions/runs/44521866034).
- Vercel production gateway deployment: Ready.
- Vercel runtime error scan: no errors in the checked 24-hour window.

The CI workflow runs typecheck, unit tests, production build, Playwright browser tests and gateway tests. The deployment workflow runs production route checks and authenticated browser verification. Counts from the next run should be recorded here after the expanded acceptance suite finishes.

## Operational dependencies and limitations

- Production SMTP is not complete until the Brevo sender domain and credentials are verified and Supabase custom SMTP is configured. Confirmation and recovery email delivery must be checked after verification.
- Multipart file uploads use the browser path and require the destination API to allow CORS from the DevLens origin.
- Real product screenshots have not yet been captured for the portfolio. Do not substitute generated mockups for screenshots of the deployed application.
- Automated responsive and interaction checks do not replace a manual visual review at the target desktop and mobile sizes.

## Related documentation

- [Setup guide](SETUP.md)
- [Architecture](ARCHITECTURE.md)
- [Deployment](DEPLOYMENT.md)
- [Security model](SECURITY.md)
- [Public sharing](SHARING.md)
- [Completion roadmap](ROADMAP.md)
