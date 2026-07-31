# Brief: D8 — the breaking-change record

## Task

Author the record that lets consumers cross this slice's break. Upgrade instructions (per the `record-upgrade-instructions` skill) enumerate from the descriptor matrices, not the diff: `count()` and integer sums return `bigint`; PostgreSQL `sum(int8)` and integer averages return decimal strings while SQLite averages return `number` (real) — the per-target divergence stated plainly; include aggregates decode the same way; contracts must be regenerated for the new `AggregateTypes` block. The same declaration set covers the incidental `packages/3-extensions/` paths D1 touched (devDependency, test import, tsconfig `rootDir`) — the standing `check:upgrade-coverage` red this dispatch turns green. The docs sweep corrects every claim that aggregates return `number` (F12 discipline: sweep by grep over docs/, READMEs, and JSDoc on the aggregate surfaces — not a spot-fix); the codec authoring guide gains its aggregate-descriptor section (authoring a descriptor, the four match kinds, exact-over-trait-over-any, the canonical-JSON relationship); the close-out ADR note records the working position for project open question 8 (one ADR or two) without authoring the ADR itself — that is close-out's, per the project spec's ADR pointer.

## Scope

**In:** upgrade instructions + declarations; docs sweep (docs/, package READMEs touched by the slice, JSDoc on public aggregate surfaces); the codec authoring guide's aggregate section; the ADR-note entry in the project's design-notes or learnings (state where you put it); `pnpm check:upgrade-coverage` green.

**Out:** the ADR itself (close-out); any code change beyond JSDoc; roadmap files (`ROADMAP.md`/`ROADMAP.html` belong to the release-notes flow, not this slice); Linear updates (orchestrator's).

## Completed when

- [ ] `pnpm check:upgrade-coverage` green; the declarations cover both the aggregate behaviour changes and D1's extension-path touches.
- [ ] `grep -rniE "aggregate.*(returns? a? ?number|number result)" docs/ packages/*/README.md` (and a sensible variant sweep) finds no stale claim; every corrected site listed in the report.
- [ ] The codec authoring guide's aggregate-descriptor section exists and shows a real, compiling descriptor example (per `adr-examples-must-match-code` discipline).
- [ ] Validation gates green.

## Standing instruction

Stay focused on the goal; control scope. Trivial-and-related fixes that obviously serve the goal go in the same dispatch with a one-line note. Anything that pulls you off the goal halts and surfaces.

## References

- `record-upgrade-instructions` skill (the declaration mechanics and where instructions live); `.agents/rules/doc-maintenance.mdc`, F12 (sweep, not spot-fix), `jsdoc-line-width`, `markdown-no-artificial-line-wraps`.
- The matrices (D3/D4) as the enumeration source; the emission shape (D5); the consumer cuts (D6/D7) for what users observe.
- Codec authoring guide: `docs/reference/codec-authoring-guide.md` (its canonical-JSON section landed with the hard cut; the aggregate section sits beside it).
- Plan § Open items: the upgrade-coverage red's provenance.

## Operational metadata

- **Model tier:** `mid` — record-shaped writing against settled decisions; escalate only if an enumeration reveals an undocumented behaviour change.
- **Time-box:** 90 minutes wall-clock. Overrun → halt and surface.
- **Halt conditions:** the enumeration surfaces a user-visible change no dispatch recorded (falsified completeness — surface it); `check:upgrade-coverage` demands a declaration shape the skill does not support.

## Validation gates

```bash
pnpm check:upgrade-coverage
pnpm build
pnpm typecheck
pnpm lint --filter <touched>
pnpm test --filter <touched>
pnpm fixtures:check   # no-op
```

Foreground only; long output saved once under `wip/`.
