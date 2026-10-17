# Repository rules

## This Repository — read ARCHITECTURE.md too

The Weekly-Planner's own operating
rules — the constraints that must not be broken — live in **`ARCHITECTURE.md`**
at the repository root. Read it at the start of every session on this repo,
before any work that touches `js/`, `css/`, `index.html`, `sw.js` or `tests/`.

It holds what used to be this file's contents; comments
throughout `js/` and `tests/` that say "see CLAUDE.md" mean `ARCHITECTURE.md`.
Among other things it is the only statement of: the classic-script / load-order
rule, the frozen merge layer and the per-key merge decision every
`state.shared` key needs, the three escaping helpers and when each applies, the
verification commands that must pass before any push, and the money, XP and
status-vocabulary ownership rules.
