# Weekly Planner — Multi-Role Review

A five-lens review of the app (single-file `index.html`, ~13.4k lines) covering
engineering correctness, visual/design quality, kid + parent flow, and the
psychology of how the product motivates children. Every finding below cites the
concrete code it comes from. A consolidated **improvement list by role** is at
the end.

Reviewed at commit on branch `claude/multi-role-review-framework-yyonzu`.

---

## 1. Senior Software Engineer — Bug Check

### 🔴 BUG-1 — Quest Board completions never advance the sticker collection
**Where:** `completeQuest()` (index.html:6065) vs `awardBlockLinks()` (index.html:6099)

`completeQuest` sets `blk.xpAwarded = true` (line 6073) *before* it calls
`awardBlockLinks(blk, key)` (line 6078). But `awardBlockLinks` does all of its
sticker / progress counting inside `if (!blk.xpAwarded) { … }` (line 6103):

```js
// completeQuest
blk.xpAwarded = true;            // 6073 — set early
const result = addQuestXP(...);  // 6076 — XP awarded directly here
awardBlockLinks(blk, key);       // 6078 — enters with xpAwarded already true
```

So when a kid taps the Quest Board's primary "blast to complete" button, the
whole block that increments `tasksCompleted`, `completedByCat`, and calls
`checkStickerUnlocks()` is **skipped**. XP is still granted (via the direct
`addQuestXP` at 6076), but the milestone counters never move.

**Impact:** The sticker collection is rendered *right on the Quest Board*
(`renderQuestStickers`, index.html:5913), and the Quest Board is the default
landing screen for kids in Hero Mode. A child who does all their tasks from the
Quest Board will **never unlock 🌱 First Step, ⭐ Rising Star, etc.**, while the
exact same tick from the Week/Day view (which routes through `toggleBlockDone` →
`awardBlockLinks` with `xpAwarded` still false, index.html:6198) *does* count.
Same action, two different outcomes.

**Fix direction:** In `completeQuest`, don't pre-set `xpAwarded` and don't call
`addQuestXP` directly — let `awardBlockLinks` be the single source of truth for
XP + counters (capture its return for the popup). Or move the counter/sticker
logic out of the `!xpAwarded` guard into its own idempotent path.

### 🟠 BUG-2 — Silent data loss on localStorage write failure
**Where:** `saveLocal()` (index.html:5097)

```js
function saveLocal() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch(e){}
}
```

The empty `catch` swallows quota-exceeded and private-mode errors. If storage is
full or blocked, the child's planner silently stops persisting with **zero user
feedback**. Combined with the last-write-wins cloud merge, a failed local write
can be quietly overwritten on the next remote snapshot.

**Fix direction:** Surface a toast / sync-status warning on catch, and treat it
as a `hasPendingSync`-style degraded state.

### 🟠 BUG-3 — Timezone inconsistency in day/month gating
**Where:** `isSunday` (index.html:6322), parent heatmap month (index.html:4922)

The app is deliberately timezone-anchored to `America/Edmonton` via
`toDayKeyInZone()` (index.html:5687) for all week/day keys. But two decision
points bypass it and use the browser's local clock:

```js
const isSunday = new Date().getDay() === 0;   // 6322 — local, not APP_TIMEZONE
const m = new Date().getMonth();              // 4922 — local, not APP_TIMEZONE
```

On a device set to a different timezone (traveling, or a mis-set tablet), the
"Sunday review" nudge and the monthly heatmap can land on the wrong calendar
boundary relative to the rest of the app's data.

**Fix direction:** Derive the weekday/month from `toDayKeyInZone(new Date())`
(parse the `YYYY-MM-DD` it returns) so all date logic shares one clock.

### 🟠 BUG-4 — The parent gate is cosmetic (security)
**Where:** `PARENT_PIN = '1234'` (index.html:5742), Firestore rules (README.md)

This reinforces the ⚠️ item already logged in `REVIEW.md`, with the full picture:
- `PARENT_PIN` is a hardcoded literal in client source — visible to anyone who
  opens dev tools; the "parent mode" gate (including money editing and backup
  export) is trivially bypassable.
- The starter Firestore rule is `allow read, write: if true` (README.md:24), and
  the app writes to a **single global document** `weekly_planner/shared_state`
  (`FS_COLLECTION`/`FS_DOC_ID`, index.html:4628-4629) with the API key committed
  in source (index.html:4618). There is no per-family scoping: any client using
  this config reads and writes the same document.

**Impact:** Not just a weak gate — with open rules and one shared doc, family
planner data has no real access boundary. Acceptable *only* as a private, single-
family deployment; it must not ship as-is to multiple families.

**Fix direction:** Per-family document id + Firebase Auth + security rules scoped
to the authenticated family; make the PIN parent-set and stored per family (still
only a soft child-lock, never the security boundary).

### 🟡 BUG-5 — Last-write-wins merge can drop concurrent edits
**Where:** `mergeRemoteState` / `pushToFirebase` (index.html:4670, 5100)
Already noted in `REVIEW.md`; flagged here for completeness. Two devices editing
in the same window can silently lose one side's change. Fine for one family;
revisit before any multi-user scaling.

---

## 2. Senior Developer — Color Combinations & Design Components

Measured WCAG 2.1 contrast ratios (AA needs **4.5:1** normal text, **3:1** large
text / UI components).

### 🔴 DESIGN-1 — White text on the orange accent fails AA (systemic)
`--accent` is `#ff7b54`. **White text on `--accent` = 2.56:1** — below AA for both
normal and large text. This pairing is used for nearly every *active/selected*
control:

| Component | Line |
|---|---|
| `.view-tab.active` | 931 |
| `.gt-item.done .gt-check` | 1404 |
| `.ct-check.on` | 1476 |
| `.filter-chip.active` | 2131 |
| `.pill-btn.active` | 2479 |
| `.obj-item.checked .obj-check` | 2491 |
| `.day-pick.active` | 2546 |

The "selected" state — the one that most needs to read clearly — is the least
legible. **Fix:** darken the accent used *behind white* to ~`#e85d32` or darker
(reaches ~4.5:1), or keep the light accent and use dark ink for the label.

### 🟠 DESIGN-2 — Accent-colored text on cream fails AA
`--accent` **as text** on `--paper`/`--bg` = **2.51:1**. Used for labels and
values, e.g. lines 1191, 1502 (`.ct-cap-note`), 1764, 1915, 2335 (`.wins-hero`),
2928, 3311. Fine for large decorative headings; **fails** for the smaller value
text (e.g. the cap-note). Use `--ink`/`--ink-muted` for anything informational,
reserve accent for large display type.

### 🟢 DESIGN-3 — What's already right (keep it)
Dark ink (`#2a2320`) on the pastel **category** palette passes AA everywhere
(sleep 7.61, school 6.89, active 6.04, free 9.15, daily 10.71, custom 7.95,
training 4.27, routine 8.28). The app consistently uses dark-on-pastel — good.
`--ink-muted` (8.02) and `--ink-light` (6.24) on paper both pass. Note: **never**
switch these tiles to white text — white on the pastels ranges 1.44–3.62 (all
fail).

### 🟡 DESIGN-4 — Duplicate design token (`--radius-sm` defined twice)
`:root` declares `--radius-sm: 10px;` (index.html:37) and again
`--radius-sm: 8px;` (index.html:68). The second wins; the first is dead and
misleading. There's a real token system here (`--space-*`, `--text-*`,
`--shadow-*`) — collapse the duplicate so the scale is trustworthy.

### 🟡 DESIGN-5 — Category color reuse & color-only meaning
`--cat-active` (`#ff7b54`) is the *same hex* as `--accent`, so "active" activities
and "selected UI" share a color — a category can visually read as a selection
state. Also, categories lean on hue to convey meaning; the app helpfully pairs
most with emoji/labels, but confirm every color-coded surface also carries a
text/icon cue for colorblind users.

### 🟡 DESIGN-6 — Maintainability: scattered inline styles
Many components carry inline `style="…"` (e.g. screen containers, badges). It
works, but it fights the otherwise-solid token layer and makes theming/dark-mode
harder later. Migrate high-traffic inline styles into classes.

---

## 3. Kid's-Eye Flow + Parent Review

### As a kid (logic & flow)
- **Fun & clear:** Quest Board landing, "blast to complete," XP bar, level tiers,
  and sparkle/"MISSION CLEAR" celebrations are genuinely motivating and age-right.
- **Broken reward loop:** because of **BUG-1**, the sticker shelf on my own Quest
  Board never fills up no matter how many quests I blast. That's the single most
  visible letdown for a kid — the reward that's shown to me doesn't respond.
- **Immersion breaks:** native `prompt()`/`confirm()` dialogs (PIN entry index.html:5767,
  and destructive actions) are jarring gray browser boxes inside an otherwise
  hand-drawn, sticker-styled world.
- **Positive framing:** "each tick is a small win," "My free time today," and
  "the rest of the time is yours" are lovely, autonomy-supporting touches.

### As a parent (reviewing kid performance)
- **The heatmap can mislead.** The parent monthly heatmap is **planning density**
  (minutes blocked per day), not completion — a densely-*planned* week looks like
  a productive one even if nothing was ticked. This is documented in `REVIEW.md`
  but is a real interpretation trap; label it explicitly in the UI as "planned,
  not completed."
- **Two economies to track.** XP (`questXP`) and chore money are entirely separate
  systems (also flagged in `REVIEW.md`). As a parent I can't tell at a glance how
  effort maps to reward.
- **The gate gives false confidence.** PIN `1234` and open Firestore rules mean the
  "parent-only" export and money editing aren't actually protected (see BUG-4).
- **Healthy loop:** the kid feedback box (index.html:3555) → parent weekly review /
  approvals is a good two-way channel; keep and strengthen it.

---

## 4. Psychologist — Review of the Underlying Logic

### 🔴 PSY-1 — The opening "manifesto" is high-pressure framing aimed at children
The profile screen (index.html:3501-3507) tells the child:

> "…the greatest athletes are not just those who train the hardest, but those who
> own their day… Develop the discipline that separates **the good from the
> great**… make every week a **masterpiece of progress and resilience**."

This is elite-performance, achievement-identity language directed at kids. It
risks **contingent self-worth** (I'm valuable when I'm productive/great),
performance anxiety, and reading rest as failure. Ironically the *same* block
also says "Protect Your Joy" and "the rest of the time is yours" — the app already
has the healthier voice. **Recommend:** lead with autonomy, curiosity, and joy;
drop the good-vs-great / masterpiece framing, or move it to a parent-only note.

### 🟠 PSY-2 — Dual extrinsic economies risk crowding out intrinsic motivation
Chores pay **money** and tasks pay **XP**. Paying children for everyday
responsibilities is the classic **overjustification effect** — once the reward is
the reason, the behavior can drop when the reward isn't there, and chores stop
feeling like family contribution. Two parallel extrinsic systems compound this.
**Recommend:** keep the money/banking sim as an intentional *financial-literacy*
lesson (it's a good one), but decouple it from "being good"; reserve some wins for
intrinsic/relational framing ("you helped the family"), not just payouts.

### 🟠 PSY-3 — All-or-nothing streaks/"MISSION CLEAR" can manufacture guilt
"MISSION CLEAR — all today's quests done" (index.html:3571) and streaks reward
perfect days. Kids have off days, sick days, and days that just don't go to plan;
all-or-nothing structures turn those into felt failures and can drive
avoidance. **Recommend:** add an explicit, celebrated **rest day / "good enough"**
state, protect streaks from single misses (a grace token), and celebrate partial
progress ("2 of 3 — nice!") not just 100%.

### 🟡 PSY-4 — Sibling comparison surface
Sister Sync and parent views place Jenn and Jess side by side. Shared *coordination*
(finding mutual free time) is pro-social and great; visible *comparison* of
performance is a known driver of sibling rivalry and demotivation for the
trailing child. **Recommend:** keep comparison out of the kids' own views; frame
any cross-kid data as collaboration, not leaderboard.

### 🟢 PSY-5 — Strong, keep these
- Stickers unlock from **real habits**, not app-opening (index.html:6157) — avoids
  engagement-for-its-own-sake dark patterns.
- Mood/reflection ritual and the kid feedback channel support **emotional literacy
  and voice**.
- "My free time" as a *celebrated* outcome reframes planning as buying freedom,
  not filling every minute — genuinely healthy.

---

## 5. Improvement List — By Role

### Senior Software Engineer
1. **Fix BUG-1:** make `awardBlockLinks` the single source of truth so Quest Board
   completions advance stickers/`tasksCompleted` like every other path. *(High)*
2. **Fix BUG-2:** surface a warning on `saveLocal` failure instead of an empty catch. *(Med)*
3. **Fix BUG-3:** route `isSunday` and the heatmap month through `APP_TIMEZONE`. *(Med)*
4. **Harden BUG-4:** per-family doc id + Firebase Auth + scoped rules; parent-set PIN
   as a soft lock only. *(High, before any multi-family use)*
5. Add a conflict-aware merge (or at least per-field timestamps) for concurrent edits. *(Low)*

### Senior Developer (Design/Front-End)
1. **Fix DESIGN-1:** darken the accent behind white (or use dark ink) so selected
   controls hit AA — this is the highest-visibility contrast failure. *(High)*
2. **Fix DESIGN-2:** use `--ink`/`--ink-muted` for informational accent text. *(Med)*
3. **Fix DESIGN-4:** remove the duplicate `--radius-sm` token. *(Low)*
4. **DESIGN-5:** give `--cat-active` its own hue distinct from `--accent`; verify a
   text/icon cue accompanies every color-coded surface. *(Med)*
5. Migrate high-traffic inline styles into token-based classes; sets up dark mode. *(Low)*

### Kid + Parent (Flow)
1. Ship BUG-1's fix so the sticker shelf actually responds to Quest Board play. *(High)*
2. Replace native `prompt()`/`confirm()` with the app's `.sheet` UI for a cohesive,
   kid-friendly feel (also in `REVIEW.md`). *(Med)*
3. Label the parent heatmap as **planned, not completed** to prevent misreading. *(Med)*
4. Add a simple parent view that maps effort → reward across both economies. *(Low)*

### Psychologist
1. **PSY-1:** rewrite the profile manifesto toward autonomy/joy/curiosity; retire the
   "good vs great / masterpiece" pressure framing (or make it parent-only). *(High)*
2. **PSY-3:** add a real rest-day state, streak-grace, and partial-progress
   celebration so off days aren't framed as failure. *(High)*
3. **PSY-2:** decouple money from "being good"; keep it as an explicit money-skills
   lesson and add intrinsic/relational recognition. *(Med)*
4. **PSY-4:** keep cross-sibling data as collaboration, never a performance
   leaderboard in the kids' views. *(Med)*
5. Preserve the good instincts — habit-based stickers, reflection ritual, free-time-as-
   reward. *(Keep)*
