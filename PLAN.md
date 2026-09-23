# Workout Tracker — Plan (v1)

Status: **approved — in progress** (see checklist in section 4).

v1 goal: one complete, reliable flow —
**create a routine → start it → log sets → finish → see it in History and Progress.**
Out of scope for v1: AI coaching, social features, smartwatch, cloud sync, accounts.

---

## 1. Key decisions

| Decision | Choice | Why |
|---|---|---|
| App type | Installable web app (PWA), phone-first | Runs on any phone, works offline, no app store needed |
| Backend | **None in v1** — all data stored on the device | Offline logging is required; no accounts or server to maintain |
| Storage | IndexedDB via Dexie | Survives app close; fast; live-updating queries |
| UI | React + TypeScript + Vite | Widely used; TypeScript catches data-shape mistakes |
| Charts | Small hand-written SVG charts (was: Recharts) | Lighter download for the phone; exact control of marks, touch and keyboard |
| Reordering | dnd-kit (drag handle) | Works with touch |
| Tests | Vitest (logic + database), Playwright in WebKit at iPhone 14 size (full flow) | |
| Weight storage | Save the number **exactly as entered, with its unit** (`100` + `lb`); convert only for display | Avoids rounding drift (e.g. 45 lb → 20.41 kg → 44.99 lb) |

**Target device: iPhone 14 (iOS Safari).** Consequences:
- The app must be **added to the Home Screen** to run full-screen and to keep its data safe long-term.
- Installing needs the app hosted on **HTTPS** (free: GitHub Pages / Netlify / Cloudflare Pages) — set up in phase 10. During development, test on the phone over Wi-Fi via the dev server.
- iPhone has **no vibration API** → rest-timer end uses sound + a visual flash. Notifications while the phone is locked are not reliable in v1.
- Inputs use 16px+ text (smaller makes iOS zoom in), numeric keypads (`inputmode="decimal"`), and safe-area padding for the notch and home bar.

**Storage risk to know about:** data lives only on the phone. Browsers can clear website data (Safari especially, if the app isn't added to the home screen). Mitigations: ask the browser for persistent storage, encourage "Add to Home Screen", and provide export + import backup.

---

## 2. Screen structure

Bottom tab bar (always visible except during an active workout):
**Today · Routines · History · Progress**. Settings = gear icon in the top-right of Today.

### Today
- **Resume card** (only if a workout is unfinished): name, elapsed time, sets done → *Resume*.
- **Start empty workout** button.
- **Your routines**: sorted by most recently used, each with a one-tap *Start*.
- Small "This week: 3 workouts" summary (counts, never a "streak broken" message — rest days are normal).

### Active Workout (full screen — the priority screen)
- **Header:** workout name (tap to rename) · elapsed time · **Finish** · ⋯ menu (workout note, discard).
- **Exercise cards**, in order. Each card:
  - Name, note icon, ⋯ menu (replace, move, remove, rest time for this exercise).
  - "Last time: 80 kg × 8, 8, 7" line.
  - **Set rows:** `#  |  Previous  |  kg  |  reps (or time)  |  ✓`
    - Weight/reps inputs show **suggested values in grey** (from last session, else routine targets).
    - Tapping ✓ with no edits confirms the suggestion → **one tap per set** in the common case.
    - A set only counts once ✓ is tapped. Tapping ✓ again un-completes it.
  - *+ Add set*; tap a set's number → Delete set (a swipe gesture was dropped: hard to discover and to make accessible). Exercises reorder via ⋯ → Move up/down.
- *+ Add exercise* at the bottom → Exercise Picker.
- **Rest timer bar** pinned above the bottom edge after a set is completed: countdown · −15s · +15s · pause · skip.
- **Undo toast** after deleting a set, or removing/replacing an exercise: "Set 2 deleted · Undo". (A completed set is undone by tapping ✓ again.)
- **Minimise** (↓) returns to the tabs; a "Workout in progress" bar stays on top of every tab.
- **Finish** → if sets are incomplete: "3 sets not completed — Discard them / Go back" → **Summary screen**: duration, sets, total volume, new personal records, workout note → *Done*.

### Exercise Picker (shared by the routine editor and the active workout)
- Search box, filter chips for **muscle group** and **equipment**, "Recent" section on top.
- *Create custom exercise*: name, muscle group(s), equipment, tracking type.

### Routines
- **List:** name, number of exercises, last performed. ⋯ menu: Start, Edit, Duplicate, Delete.
- **Routine editor:** name, note, exercises (drag to reorder). Per exercise: planned sets (rows with target reps or target time, optional target weight), rest time.
- **Exercise Library** (button in the Routines header): browse/search all exercises, edit/archive custom ones, open an exercise's progress.

### History
- Toggle **Calendar / List**.
  - Calendar: month view with a dot on workout days; tap a day to see its workouts.
  - List: newest first, grouped by month; each row shows name, date, duration, exercise count.
- **Workout detail:** date, start/end time, duration, note, every exercise and completed set.
  - *Edit*: the same set-row UI as the active workout (no timer). Can change values, add/remove sets and exercises, change date/duration and notes.
  - *Delete* (with confirmation).

### Progress
- Exercise selector (search; defaults to most-logged exercise).
- **Chart** with metric toggle and time range (1M · 3M · 1Y · All):
  - Weight exercises: heaviest weight · best reps · total volume.
  - Timed exercises: longest set · total time.
  - X axis is the calendar date, so gaps (rest days, breaks) are shown honestly and not penalised.
- **Personal records:** heaviest weight, most reps, best session volume, longest time — each links to its workout.
- **Workouts per week** bar chart.

### Settings
- Units: **kg / lb** (display unit; stored values are never altered).
- Default rest time; auto-start rest timer on/off.
- **Export** data: JSON (full backup) and CSV (one row per set, for spreadsheets).
- **Import** a JSON backup.
- **Delete all data** (type DELETE to confirm).

---

## 3. Data model

All records live in IndexedDB. A workout stores its exercises and sets **inside it** (one record), so every auto-save is a single atomic write and recovery is simply "load the workout whose status is active".

```ts
type ID = string;                 // crypto.randomUUID()
type WeightUnit = 'kg' | 'lb';
type TrackingType = 'weight_reps' | 'reps_only' | 'duration';

type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'forearms'
  | 'core' | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'full_body';
type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight'
  | 'kettlebell' | 'band' | 'other';

interface Exercise {
  id: ID;
  name: string;
  muscleGroups: MuscleGroup[];     // first = primary
  equipment: Equipment;
  trackingType: TrackingType;
  note: string;                    // lasting cues / machine settings ("seat 4, pins at 6")
  isCustom: boolean;
  archived: boolean;               // hidden from picker but kept for history
  createdAt: string; updatedAt: string;   // ISO timestamps
}

interface PlannedSet {
  targetReps?: number;
  targetDurationSec?: number;
  targetWeight?: number;
  targetWeightUnit?: WeightUnit;
}

interface RoutineExercise {
  id: ID;
  exerciseId: ID;
  sets: PlannedSet[];              // order = set order
  restSec: number;
  note: string;
}

interface Routine {
  id: ID;
  name: string;
  note: string;
  exercises: RoutineExercise[];    // order = exercise order
  createdAt: string; updatedAt: string;
}

interface SetEntry {
  id: ID;
  weight: number | null;           // null = not typed yet (UI shows suggestion)
  weightUnit: WeightUnit;
  reps: number | null;
  durationSec: number | null;
  completed: boolean;
  completedAt: string | null;
}

interface WorkoutExercise {
  id: ID;
  exerciseId: ID;
  restSec: number;
  note: string;                    // note for this session only ("felt heavy")
  sets: SetEntry[];
}

interface RestTimer {
  durationSec: number;
  endsAt: string | null;           // set while running
  pausedRemainingSec: number | null; // set while paused
}

interface Workout {
  id: ID;
  name: string;
  routineId: ID | null;
  status: 'active' | 'completed';
  startedAt: string;
  endedAt: string | null;
  note: string;
  exercises: WorkoutExercise[];
  exerciseIds: ID[];               // copy of exercises[].exerciseId, indexed for fast lookups
  restTimer: RestTimer | null;     // stored so the timer survives closing the app
  updatedAt: string;
}

interface Settings {               // single record, id = 'settings'
  displayUnit: WeightUnit;
  defaultRestSec: number;          // default 90
  autoStartRest: boolean;          // default true
}
```

**Database indexes (Dexie):**
`exercises: id, name, *muscleGroups, equipment` ·
`routines: id, updatedAt` ·
`workouts: id, status, startedAt, *exerciseIds` ·
`settings: id`

### Rules that the code must follow
- **Conversion:** 1 lb = 0.45359237 kg exactly. Convert only for display and charts; round the display to 0.1.
- **Suggestions** (never stored as real values): for set *n*, use set *n* of the most recent completed workout containing that exercise **that started before the current one** (so editing an old workout compares with the session before it); if there is none, use the last set from it; otherwise the nearest filled-in set above it in this workout (so a brand-new exercise is one tap per set after set 1); otherwise the routine targets. When ✓ is tapped, empty fields are filled from the suggestion. A suggested weight **keeps its original unit** (225 lb stays 225 lb even when logging in kg); the screen converts it only for display, so accepting it causes no rounding drift. If an exercise appears twice in a workout, the 2nd appearance is suggested from last time's 2nd appearance (`previousSetsFor`).
- **What counts:** history, stats, PRs and "last time" use **completed sets only**.
- **Auto-save:** every change writes the whole workout record immediately. No save button anywhere. A save is refused (`StaleSaveError`) if the workout was finished, discarded or deleted in the meantime — the screen should ignore that error, never retry it.
- **Undo:** deleting a set, removing or replacing an exercise shows an Undo toast. Undo puts back just that one thing (never a whole snapshot), so changes made after it are kept. Completing a set is undone by tapping ✓ again.
- **Rest timer** is based on the `endsAt` timestamp, not on counting ticks, so it stays correct after the phone locks or the app is closed. It starts when a set is ticked (if auto-start is on and the exercise has a rest time); un-ticking a set leaves a running rest alone. It beeps once when it runs out while the app is open (not for a rest that ended while closed, nor when you shorten it to zero yourself).
- **Deleting a custom exercise** that appears in history archives it instead.
- **Volume** = Σ(weight × reps) over completed sets, converted to the display unit.

---

## 4. Implementation plan

Each phase ends with passing tests, a tester-agent check, and a git commit.
The order builds the **thinnest complete flow first** (phases 0–5), then deepens it.

- [x] **0. Project setup** — Vite + React + TS, oxlint, Vitest, Playwright, PWA plugin, tab shell with 4 empty tabs, base styles (large tap targets ≥ 48px, readable 16px+ text, light/dark).
- [x] **1. Data layer** — types, Dexie schema, unit conversion, seed library (~80 common exercises), functions for routines/workouts/settings. Unit tests for conversion, suggestions, volume, PRs.
- [x] **2. Exercise library + picker** — search, filters, recent, custom exercise create/edit/archive.
- [x] **3. Routines** — list, editor with reorder, duplicate, delete. (Reorder: drag handle or ⋯ → Move up/down. Automated tests use the menu; finger-drag was checked by hand — simulated touch drags are unreliable in WebKit.)
- [x] **4. Active workout (core)** — start from routine or empty; set rows with suggestions and ✓; add/remove sets; add/replace/remove/reorder exercises; notes; undo; auto-save; resume after reload; finish + summary. Also: add an icon-only `IconButton` (button version of `IconLink`, same 48px style); switch app updates from `autoUpdate` to prompt-based so a new version never reloads the page during a workout.
- [x] **5. History (basic)** — list + workout detail. ✅ *Milestone: full flow works end-to-end.* Playwright test covers it.
- [x] **6. Rest timer** — auto-start, pause, skip, ±15s, survives reload; vibration/sound where supported.
- [x] **7. History (full)** — calendar view, edit past workouts, delete.
- [x] **8. Progress** — per-exercise charts, time ranges, PRs, workouts-per-week.
- [x] **9. Settings & data** — units, rest defaults, export JSON/CSV, import JSON, delete all.
- [ ] **10. Reliability & polish** — (check on the iPhone, installed to the Home Screen: “Save a backup” opens the share sheet — the plain-download fallback may not work in Home Screen apps) — (if History gets slow with years of data: store per-workout summary fields or page the list) — offline check (airplane mode), persistent storage request, install prompt, accessibility pass, final full test + review.

### How agents are used here
- **Main agent:** plans and builds each phase in order. Phases 0–4 all touch the shared data types, so they run one at a time.
- **tester** (subagent): runs unit + end-to-end tests and checks screens at phone size after each phase. Reports; does not fix.
- **reviewer** (subagent, read-only): reviews each phase before its commit.
- **First parallel experiment (optional):** once phase 5 is done, phases 7 (History) and 8 (Progress) touch different folders and can run in two separate worktrees at the same time.
