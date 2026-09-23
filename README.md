# Workout Tracker

A phone-first workout log for weightlifting (and timed exercises like planks). Plan routines,
log sets with as few taps as possible, and see your progress. It works offline and keeps
everything on your phone — there's no account and no server.

- **Today** — start a routine or an empty workout, or resume the one in progress
- **Routines** — build reusable workouts; the exercise library lives here too
- **History** — past workouts as a list or calendar; edit or delete them
- **Progress** — charts per exercise, personal records, workouts per week

## Try it on your computer

You need [Node.js](https://nodejs.org) (version 24 or newer).

```bash
npm install
npm run dev
```

Open the "Local" address it prints. To try it on your iPhone, connect the phone to the same
Wi-Fi and open the "Network" address in Safari (Windows may ask to allow Node.js through the
firewall the first time). This is a preview only: offline mode and Add to Home Screen need the
published app on an https address — see below.

## Put it online (so you can install it on your iPhone)

Installing to the Home Screen needs the app on a secure (https) address. Two free options:

### Option A — GitHub Pages (updates itself when you push changes)

1. Create a free account at [github.com](https://github.com) and a new **empty** repository,
   e.g. `workout-tracker`.
2. In this folder, connect it and push:
   ```bash
   git remote add origin https://github.com/<your-username>/workout-tracker.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Source: GitHub Actions**.
4. The included workflow (`.github/workflows/deploy.yml`) runs the tests, builds and publishes.
   After a minute or two the app is at `https://<your-username>.github.io/workout-tracker/`.
   (Naming the repository `<your-username>.github.io` also works; it then lives at the site root.)

### Option B — Netlify or Cloudflare Pages (drag and drop)

1. Build the app: `npm run build` — this creates a `dist` folder.
2. Create a free account at [netlify.com](https://netlify.com) (or Cloudflare Pages) and drag
   the `dist` folder onto its "deploy manually" area. You get an `https://…` address.
3. Repeat step 1–2 whenever you want to publish a new version.

## Install on your iPhone

1. Open the app's https address in **Safari**.
2. Tap **Share** → **Add to Home Screen**.
3. Open it from the Home Screen, then turn on **Airplane Mode** and open it again — it should
   still work. That confirms offline mode on your phone.
4. Open it from the Home Screen from now on. It runs full-screen, works offline, and iOS keeps
   its data safe. (Data saved in a normal Safari tab can be cleared by iOS after a few weeks of
   not visiting.)

When a new version is published, the app shows a small **Update** banner — never in the
middle of a workout.

## Your data

Everything is stored only on the phone. Use **Settings → Save a backup** now and then (it
opens the share sheet — "Save to Files" works well). **Restore from a backup** brings it back
on the same or a new phone. **Export spreadsheet** gives a CSV with one row per set.

## For developers

See [CLAUDE.md](CLAUDE.md) for the stack, commands and rules, and [PLAN.md](PLAN.md) for the
design, data model and build phases.

```bash
npm test            # unit + component tests (Vitest)
npm run test:e2e    # builds, then end-to-end tests in WebKit at iPhone 14 size (Playwright)
npm run test:offline # production build in a sub-folder: service worker takes over and caches everything
npm run typecheck && npm run lint
```
