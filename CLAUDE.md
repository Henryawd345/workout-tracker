# Workout Tracker

Phone-first, offline workout logging app (weightlifting + timed exercises). Installable web app (PWA); all data stored on the device in IndexedDB.

**Read `PLAN.md` first** — it holds the screen structure, data model, rules and phase checklist. Work one phase at a time, in order, and tick its checkbox when it is done.

## Stack
React 19 + TypeScript + Vite · React Router (hash routes, `src/router.tsx`) · CSS Modules + tokens in `src/styles/global.css` · Dexie (IndexedDB) · hand-written SVG charts in src/components/charts (follow the dataviz rules: 2px lines, ringed dots, hairline grid, table view) · dnd-kit · Vitest + Testing Library · Playwright (WebKit, iPhone 14) · vite-plugin-pwa · oxlint

## Commands
- Dev server: `npm run dev` (also reachable from the phone on the same Wi-Fi — use the "Network" URL it prints)
- Unit tests: `npm test` — files named `src/**/*.test.ts(x)`; render the app with `renderApp()` from `src/test/renderApp.tsx`
- End-to-end tests: `npm run test:e2e` — builds first (the offline check reads `dist/`), then runs `e2e/` against the dev server; includes an axe accessibility scan
- Offline check: `npm run test:offline` — production build served from /wt/ (like GitHub Pages); service worker control + cache contents
- Deploy: see README (GitHub Pages workflow in `.github/workflows/deploy.yml` sets `BASE_PATH`)
- Lint / type check / build: `npm run lint` / `npm run typecheck` / `npm run build`

## Layout
- `src/screens/` one file per screen · `src/components/` shared UI · `src/data/` types, database, calculations
- Screens import data functions from `src/data/index.ts` only. All database writes go through the functions in `src/data/` (never call `db.*` from a screen).
- Data tests: call `resetDb()` in `beforeEach`; build test data with helpers in `src/test/factories.ts`.
- Changing the database indexes means adding `db.version(2)` in `src/data/db.ts` — never edit version 1.
- Use the colour/spacing variables from `global.css`; never hard-code colours.

## Rules
- The **active workout screen** is the priority: fewest taps, large tap targets (≥ 48px), readable text (≥ 16px).
- Never lose data: every change auto-saves; no save buttons. Unfinished workouts must be resumable after a reload.
- Weights are stored exactly as entered with their unit; convert only for display (1 lb = 0.45359237 kg).
- Only **completed** sets count toward history, stats, PRs and "last time".
- Data-layer code (types, database, calculations) lives in `src/data/` and must have unit tests.
- Keep dependencies to those in the stack above unless there's a clear reason; mention any new one.
- After each phase: run tests, use the **tester** agent, then the **reviewer** agent, then commit.
