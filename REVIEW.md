# Weekly Planner — Front-End Review

Scope: full-app design / flow / accessibility / correctness pass accompanying the
**Chore Groups with Direct Pricing** rebuild. Fixes marked ✅ **Fixed** were applied in
this change; ⚠️ **Open** items are documented for follow-up.

---

## Fixed in this change

- ✅ **Chore checkboxes were not keyboard-accessible.** They were `<div onclick>` with no
  role/tabindex. Now rendered as `<button role="checkbox" aria-checked>` with a visible
  focus ring, driven by event delegation on `#choreWrap`.
- ✅ **Unsafe string interpolation in click handlers.** Chore names were injected into inline
  `onclick="ctToggleOptional('…')"` with only naive quote-escaping — fragile once names became
  user-editable. Replaced with `data-*` attributes + a single delegated handler
  (`ctHandleWrapClick`); a new `escapeAttr()` escapes attribute contexts. Verified no HTML
  injection from a hostile group name.
- ✅ **Saving weekly goals wiped an already-earned goal bonus.** `ctSaveGoalsFromUi` blanket-reset
  both kids' bonuses on every save. Removed; `ctSetWeekGoals` already clears a bonus only when its
  goal is removed, and a lowered goal now re-fires immediately.
- ✅ **"Export backup" was exposed to kid profiles**, leaking full family JSON. Now parent-only.
- ✅ **Kids in Hero Mode never saw pocket money.** The Quest Board (default landing for kids) showed
  XP only. Added a read-only money strip (this week's $ + per-group progress chips) that taps
  through to the chore tab.
- ✅ **Money-model copy was misleading.** The old UI said "+1 point each … bonus days" while money
  actually counted *days with ≥1 chore*. The rebuild replaces this with explicit priced groups, so
  the earning rule is now literally shown on each group card and the money card.
- ✅ **Legacy standalone Chore-Tracker retired.** Removed the read-only Firestore listener on
  `chore-tracker/family-data` and its three call sites; `readLegacyCompatibility` now defaults off.
  Already-imported data and the one-time local migrations are preserved.

## Open findings (follow-up)

- ⚠️ **Parent PIN is hardcoded client-side** (`PARENT_PIN = '1234'`, index.html). The entire
  parent gate — including money editing — is cosmetic and trivially bypassable by anyone reading
  the source. A real gate needs server-side/Firestore-rule enforcement; not fixable purely in the
  client. **Recommend**: at minimum make the PIN parent-configurable and stored per-family, and
  scope Firestore writes with security rules.
- ⚠️ **Two parallel progress economies.** Quest Board XP (`questXP`) and chore points/money are
  entirely separate systems with separate storage. The new money strip bridges *visibility*, but
  the data models remain siloed. Worth a product decision on whether they should converge.
- ⚠️ **Firestore `shared.chore` merges last-write-wins wholesale.** Simultaneous edits on two
  devices can drop one side's change (same exposure the pre-existing `goalBonusByWeek` already had;
  the new `groups`/`groupPayoutsFired` inherit it). Acceptable for a family app; note it before
  scaling.
- ⚠️ **Blocking `confirm()`/`prompt()` dialogs** are used for destructive actions and PIN entry.
  Functional, but inconsistent with the app's custom sheet aesthetic and not stylable. Consider
  migrating to the existing `.sheet` pattern for a more cohesive flow.

## Notes

- Parent monthly heatmap is **planning-density** based (block minutes/day), not routine/chore
  completion — unchanged by this work, as required.
- Verified end-to-end with headless Chromium against all feature acceptance checks (sticky payout,
  $6 cap with goal bonus, daily multi-day payout, neutral routine toast, frozen historical weeks,
  legacy retirement, editor round-trip, escaping, Quest strip).
