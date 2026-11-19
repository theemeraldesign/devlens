# DevLens

> See your APIs clearly.

DevLens is an open-source API development studio for building requests, inspecting responses, organizing collections, and working with environments.

## Status

Early development. The first milestone establishes the application foundation, request engine, and security boundaries before account and cloud-sync features.

## Planned stack

- React, Vite, TypeScript
- Tailwind CSS
- Cloudflare Workers with Static Assets
- Supabase Auth and PostgreSQL
- Vitest and Playwright

## Development

Requirements: Node.js 22+

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and add the Supabase project URL and publishable key when configuring account features.

## Security

API requests are sent through the DevLens Worker. The server-side request proxy must enforce URL scheme, private-network, redirect, timeout, and response-size restrictions. Never put Supabase service-role credentials in browser code.

## License

MIT