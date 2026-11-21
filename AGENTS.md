# DevLens engineering guide

## Product
DevLens is a focused API development studio. Its promise is clarity, control and trustworthy request inspection. Build working product flows, not decorative demo screens.

## Design system

`DESIGN.md` is the authoritative design system for all screens. Read it before making UI changes and keep the landing page, workspace, collections, environments, history, utilities, auth flows and shared collection views consistent with its tokens and component recipes.

- Preserve DevLens's purpose as a secure API development workspace.
- Use the graphite/paper themes, copper primary action, mint success state and red error state defined in `DESIGN.md`.
- Use Inter Tight as the only interface font.
- Apply the documented type scale, spacing, radii, surfaces, shadows and motion limits.
- Do not copy Tekcify branding, violet colours, copy or studio-specific sections.
- Do not change request logic, authentication, sharing, storage or security behaviour during visual-only work.
- Keep the desktop request/response workflow information-dense and mobile layouts touch-friendly.

## Accessibility release gate
- Every input has an associated label.
- Every modal supports Escape, focus trapping and focus restoration.
- Keep a visible focus ring and a first-focusable skip link.
- Mobile touch targets should be at least 44 CSS pixels.
- Respect reduced-motion preferences.
- Test 375px, 768px, 1024px and 1440px layouts before release.

## Engineering
- TypeScript strict mode. Avoid `any`.
- Keep request logic in `src/lib`, reusable UI in `src/components`, and Worker routes in `worker`.
- Pin direct dependency versions and keep the dependency graph reviewed.
- Add unit tests for utility and security behavior. Add Playwright tests for important user journeys.
- Run typecheck, unit tests and build before declaring a change complete.
- Keep migrations in `supabase/migrations` and apply them to the dedicated DevLens project only.

## Security
- Never expose Supabase secret/service-role keys in browser code.
- Guest data stays in local browser storage until the user explicitly imports it.
- Private tables require RLS and owner-scoped policies.
- Public collection reads must use the restricted public snapshot surface. Never expose owner IDs, collection IDs, environment variables, history or credentials.
- Never log request headers, request bodies, credentials or full URLs containing query secrets.
- Do not deploy the request proxy publicly until DNS rebinding and outbound egress controls have been reviewed and resolved.
- Do not follow upstream redirects automatically. Revalidate each destination.
