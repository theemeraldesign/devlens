# DevLens production release record

## Release

- Product version: 0.1.0
- Production origin: https://devlens.cc.cd
- Source repository: https://github.com/theemeraldesign/devlens
- Production branch: `main`
- Release verification date: 19 November 2026
- Verified source commit: `3e07840dc86ee5c386fb9835324a6db1eedaf7ca`

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

- GitHub CI workflow: [run 44528844923](https://github.com/theemeraldesign/devlens/actions/runs/44528844923), successful.
- Cloudflare deployment workflow: [run 44528844870](https://github.com/theemeraldesign/devlens/actions/runs/44528844870), successful.
- TypeScript check and production build: passed.
- Unit tests: 69 passed.
- Gateway security tests: 7 passed.
- Playwright browser checks: 28 passed, 1 skipped. The skipped case is the live external API smoke test, which remains opt-in and was not repeated in this release pass.
- Production route smoke tests: passed.
- Authenticated production browser checks: passed, including publish, open, import, unpublish and expired-session retry.
- Vercel production gateway deployment for the verified commit: Ready.
- Vercel runtime error scan: no errors in the checked 24-hour window.

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
