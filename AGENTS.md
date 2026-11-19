# DevLens engineering guide

## Product
DevLens is a focused API development studio. Its promise is clarity, control and trustworthy request inspection. Build working product flows, not decorative demo screens.

## Design system

DevLens follows a deliberate product thesis: a precision instrument panel for API work. High information density, cool-neutral surfaces, warm copper action accent, clear response states and restrained ornament. Every layout choice should support scanning, editing or inspecting an API request. The six design axes are: high density, medium formality, low energy, medium warmth, low ornament and high contrast. The desktop workspace uses a split request/response layout. Mobile switches to a compact bottom navigation and stacked content.
- Keep the interface restrained, precise and information-dense without feeling crowded.
- Use DM Sans for interface text and DM Mono for URLs, methods, code and metadata.
- Keep the dark and light themes equally complete, with contrast checked separately in both modes.
- Use copper for actions, green for success and red for errors. Do not reuse status colors as decoration.
- Use the existing spacing, borders, muted text and accent tokens in `src/styles.css`.
- Prefer subtle graphite/paper surfaces, a warm copper accent and functional states over gradients, glass effects, oversized hero sections or generic AI-generated layouts.
- Keep success green and error red reserved for status feedback. Do not use the brand accent as a success color.
- Preserve responsive behavior at desktop, tablet and mobile widths.
- Every visible control must have a real action, a clear disabled state or an explicit not-yet-available label.

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
