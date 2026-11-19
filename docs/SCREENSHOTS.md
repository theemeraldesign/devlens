# DevLens portfolio screenshots

The production deployment workflow captures these images from the live production application at https://devlens.cc.cd using the dedicated authenticated E2E account. It uses realistic, non-sensitive demo content and masks the account label before capture.

Images are stored in `docs/screenshots/` and embedded in the root README.

## Current screenshot set

- `landing-desktop.png`, public landing page at 1440 × 900.
- `workspace-desktop.png`, authenticated request studio at 1440 × 900.
- `workspace-mobile.png`, authenticated workspace at 390 × 844.
- `collections-desktop.png`, sample collection with a saved request.
- `environments-desktop.png`, demo environment with non-secret values.
- `response-inspector.png`, sample JSON response with status and headers.
- `shared-collection.png`, public read-only collection view.
- `history-desktop.png`, request history screen.
- `utilities.png`, JSON formatter with a sample payload.

## Refresh process

The production deployment workflow runs `scripts/capture-portfolio-screenshots.mjs` after authenticated browser tests. It captures the images and commits changed screenshots to the repository.

To capture locally against the production site:

```bash
PLAYWRIGHT_BASE_URL=https://devlens.cc.cd \
DEVLENS_E2E_EMAIL=your-dedicated-test-account \
DEVLENS_E2E_PASSWORD=your-test-account-password \
node scripts/capture-portfolio-screenshots.mjs
```

Do not use a personal account for screenshot automation. Keep all sample values synthetic. Never capture real API tokens, passwords, customer data, private URLs or personal account details.
