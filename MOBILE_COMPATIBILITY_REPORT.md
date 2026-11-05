# Mobile compatibility

The UI has a dedicated phone layout (November 2026):

- Header with a hamburger drawer, a bottom navigation bar and full-screen sheets for notifications and the design studio.
- Home and admin dashboards render flat tappable tiles on phones; the 3D tilt cards stay on desktop.
- Every data table becomes a stacked card list below 768px (automatic via `MobileTableEnhancer` + `globals.css`); sort buttons and header filters become a chip bar.
- All dialogs use the responsive `Sheet` primitive: bottom sheet on phones, capped to the visible viewport (`dvh`), with pinned header and footer.
- Inputs are forced to 16px on phones (no iOS focus zoom); touch targets are at least 44px.

Automated checks live in `tests/mobile.spec.ts` (iPhone 13 and iPhone SE projects): every main route is loaded with a minted session cookie and must have no element outside the viewport; the drawer, bottom nav, notification sheet, design studio and card tables are exercised. Run:

```bash
PW_BASE_URL=http://localhost:3000 npx playwright test --project=mobile --project=mobile-small
```
