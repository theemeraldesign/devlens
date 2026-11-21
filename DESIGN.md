---
version: 1.0
name: DevLens
description: "A focused API development workspace. Tekcify's measured typography, spacing and surface discipline adapted to DevLens graphite, paper and copper identity."
product: "Compose HTTP requests, inspect responses, organise collections and environments, and share sanitised read-only snapshots."
breakpoints:
  mobile: 767px
  tablet: 1024px
  container: 1440px
themes:
  dark:
    background: "#10141B"
    surface: "#171D26"
    surface-raised: "#1B222D"
    surface-inset: "#111720"
    on-surface: "#E7EBF2"
    on-surface-strong: "#F7F8FA"
    on-surface-variant: "#AAB4C2"
    muted: "#8994A4"
    outline: "#29313D"
    outline-strong: "#3A4554"
    primary: "#E5A267"
    on-primary: "#17120E"
    primary-soft: "#33271D"
    secondary: "#79D4A6"
    on-secondary: "#10251C"
    danger: "#FF8585"
    danger-soft: "#321F22"
    overlay: "#05080DBB"
  light:
    background: "#F4F6F9"
    surface: "#FFFFFF"
    surface-raised: "#F7F9FC"
    surface-inset: "#EEF2F6"
    on-surface: "#1B2533"
    on-surface-strong: "#111827"
    on-surface-variant: "#526174"
    muted: "#5F6D7F"
    outline: "#E4E8EF"
    outline-strong: "#CBD4DF"
    primary: "#9A5528"
    on-primary: "#FFFFFF"
    primary-soft: "#F8EEE4"
    secondary: "#11704F"
    on-secondary: "#FFFFFF"
    danger: "#B42318"
    danger-soft: "#FDECEC"
    overlay: "#17203366"
typography:
  fontFamily: "Inter Tight"
  fallback: "Inter Tight, Helvetica Neue, Helvetica, sans-serif"
  display-hero: { fontSize: 96px, mobile: 45px, fontWeight: 500, lineHeight: 0.96, letterSpacing: "-0.052em" }
  headline-display: { fontSize: 64px, mobile: 41.5px, fontWeight: 500, lineHeight: 0.98, letterSpacing: "-0.052em" }
  headline-lg: { fontSize: 48px, mobile: 36px, fontWeight: 500, lineHeight: 1.02, letterSpacing: "-0.045em" }
  headline-md: { fontSize: 32px, mobile: 28px, fontWeight: 500, lineHeight: 1.08, letterSpacing: "-0.04em" }
  headline-sm: { fontSize: 24px, mobile: 22px, fontWeight: 500, lineHeight: 1.15, letterSpacing: "-0.035em" }
  title-lg: { fontSize: 18px, fontWeight: 600, lineHeight: 1.3, letterSpacing: "-0.025em" }
  body-lg: { fontSize: 16px, fontWeight: 500, lineHeight: 1.55, letterSpacing: "-0.015em" }
  body-md: { fontSize: 14px, fontWeight: 400, lineHeight: 1.55, letterSpacing: "-0.01em" }
  body-sm: { fontSize: 12px, fontWeight: 400, lineHeight: 1.5, letterSpacing: "-0.01em" }
  caption: { fontSize: 11px, fontWeight: 400, lineHeight: 1.35, letterSpacing: "0" }
  label-md: { fontSize: 13px, fontWeight: 500, lineHeight: 1.4, letterSpacing: "-0.01em" }
  label-sm: { fontSize: 10px, fontWeight: 500, lineHeight: 1.4, letterSpacing: "0.04em" }
rounded:
  xs: 4px
  sm: 8px
  md: 16.2px
  lg: 24px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 24.88px
  xl: 40px
  section: 88px
  container: 1440px
  workspace-gutter: 32px
  mobile-gutter: 16px
components:
  button-primary:
    backgroundColor: "{themes.dark.primary}"
    textColor: "{themes.dark.on-primary}"
    height: 40px
    padding: "0 18px"
    rounded: "{rounded.full}"
  button-secondary:
    backgroundColor: "{themes.dark.surface-raised}"
    textColor: "{themes.dark.on-surface}"
    height: 38px
    padding: "0 16px"
    rounded: "{rounded.full}"
    border: "1px solid {themes.dark.outline}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{themes.dark.on-surface-variant}"
    height: 36px
    padding: "0 12px"
    rounded: "{rounded.full}"
  icon-button:
    size: 36px
    rounded: "{rounded.full}"
  input-field:
    backgroundColor: "{themes.dark.surface-inset}"
    textColor: "{themes.dark.on-surface}"
    typography: "body-md"
    height: 40px
    padding: "0 12px"
    rounded: "{rounded.sm}"
    border: "1px solid {themes.dark.outline}"
  request-method:
    typography: "label-sm"
    rounded: "{rounded.full}"
    padding: "4px 9px"
  tab:
    typography: "label-md"
    height: 40px
    activeIndicator: "{themes.dark.primary}"
  card:
    backgroundColor: "{themes.dark.surface}"
    textColor: "{themes.dark.on-surface}"
    typography: "body-md"
    rounded: "{rounded.md}"
    border: "1px solid {themes.dark.outline}"
  response-success:
    textColor: "{themes.dark.secondary}"
    backgroundColor: "{themes.dark.surface-raised}"
  response-error:
    textColor: "{themes.dark.danger}"
    backgroundColor: "{themes.dark.danger-soft}"
  code-surface:
    backgroundColor: "{themes.dark.surface-inset}"
    textColor: "{themes.dark.on-surface}"
    rounded: "{rounded.sm}"
motion:
  fast: 0.15s
  standard: 0.25s
  emphasis: 0.4s
  maximum: 0.55s
  easing: "cubic-bezier(0.16, 1, 0.3, 1)"
---

# DevLens Design System

## Product intent

DevLens is a secure API development workspace, not a generic SaaS dashboard. Every screen should help a developer compose a request, understand a response, organise API work, or manage the workspace.

The interface should feel precise, calm, dependable and information-dense. The request editor and response inspector are the centre of the product. Marketing pages explain the workflow, but must not look like a different product.

## Design principles

- Preserve the DevLens graphite, paper, copper and mint identity.
- Use the same component language across the landing page, request workspace, collections, environments, history, utilities, authentication, and shared collection views.
- Give the request URL and Send action clear visual priority.
- Keep method, status, duration, size and environment metadata easy to scan.
- Use copper for primary actions and active navigation only.
- Reserve mint for successful response states and red for errors or destructive warnings.
- Use raised surfaces sparingly. Separate panels through tonal contrast, borders and subtle shadows.
- Prefer real product previews and meaningful data over decorative dashboard illustrations.
- Do not add gradients, glass effects, glow, random blobs, excessive badges or decorative charts as filler.
- Keep motion quick and functional. Respect reduced-motion preferences.

## Color usage

Dark mode is the primary DevLens theme:
- Graphite is the workspace canvas.
- Panel and raised-panel tones separate navigation, request editing and response inspection.
- Copper identifies the main action and current selection.
- Mint identifies successful requests and healthy connection states.
- Red identifies errors, invalid input and destructive actions.

Light mode uses paper, white and cool-grey surfaces with the same semantic roles. Never use a success or error color as a brand accent. Maintain readable contrast in both themes.

## Typography

Inter Tight is the only interface typeface. Use the scale in the frontmatter. Keep headings compact and medium-weight. Body text should remain readable at normal zoom. Use the same family for labels, URLs, request metadata and code controls; use tabular numerals where numeric alignment matters. Do not introduce another display font.

## Layout

- Maximum content width: 1440px.
- Breakpoint: 767px for mobile navigation and stacked workspace layout.
- Tablet layouts should preserve usable request and response panels without horizontal page overflow.
- Use 8px, 12px, 24.88px and 40px as the core spacing steps.
- Desktop workspace: persistent navigation rail, compact top bar, request editor and response inspector in a clear split or stacked composition based on available width.
- Mobile workspace: compact top bar, touch-sized controls, stacked request and response panels, and a compact bottom navigation.
- Keep primary actions visible without forcing users to scroll past decorative content.

## Component recipes

### Navigation
Use a quiet sidebar on desktop. Active navigation uses a subtle copper-tinted surface and copper icon/text. Keep labels concise. On mobile, use a compact bottom navigation or a clearly labelled sheet. All navigation items must remain keyboard accessible.

### Request composer
- Method selector and URL input form one clear control group.
- Use a distinct but restrained method label for GET, POST, PUT, PATCH, DELETE, HEAD and OPTIONS.
- Keep Send as the primary copper action.
- Params, Headers, Body and Auth are tabs with a clear active indicator.
- Use aligned key/value rows with visible enabled states and compact add/remove actions.
- Inputs use the inset surface and a visible focus ring.

### Response inspector
- Show status, duration and response size together.
- Keep Pretty, Raw and Headers as a tab group.
- Use a stable code surface with readable line height and wrapping rules.
- Make copy and download actions secondary.
- Empty, loading, success and error states must be distinct and useful.

### Collections and history
Use compact rows or structured tables for scannable request lists. Show method, request name or path, and relevant status metadata. Row actions belong in a consistent overflow menu. Empty states explain the next useful action.

### Environments
Present environment selection clearly. Distinguish variable names from values. Mask secrets by default and never expose environment values in public collection snapshots.

### Dialogs and menus
Use accessible dialogs for create, rename, import and destructive confirmation flows. Use command menus for global search and quick actions where supported. Provide keyboard focus, Escape handling, clear labels and visible focus states.

### Feedback
Use concise inline validation for field errors and non-blocking notices for completed actions. Never rely on color alone to communicate status.

### Landing page
Use a focused product-first hero, a real request/response preview, concise capability sections, a clear workflow explanation, and a restrained security section. Do not copy Tekcify's studio content, train animation, product list, testimonials, or wording.

## Responsive and accessibility rules

- Test 375px, 768px, 1024px and 1440px widths.
- Keep mobile touch targets at least 44px where practical.
- Associate every input with a visible or programmatic label.
- Keep keyboard navigation and visible focus indicators.
- Respect `prefers-reduced-motion`.
- Do not hide essential functionality behind hover-only interactions.
- Ensure dialogs, menus and tabs expose correct accessible roles and states.

## Do

- Use the tokens in this file as the source of truth.
- Keep every screen consistent with the same spacing, type, surfaces, radii and interaction states.
- Use real request methods, response codes, paths and environment labels in examples.
- Keep visual hierarchy tied to task priority.

## Do not

- Copy Tekcify's violet palette, copy, brand, or studio-specific sections.
- Replace DevLens's purpose with a generic software-agency landing page.
- Add new fonts, random accent colours, unnecessary dependencies or decorative components.
- Change request logic, authentication, sharing, storage or security behaviour as part of a visual-only task.
- Claim a screen or deployment is verified without testing it.
