# Brief: D6 — TSDoc for root-position semantics

## Task

Document the rule this slice made true, on the methods where a user meets it. Before this slice, `.take(10).aggregate(...)` silently reduced over every matching row; now it reduces over the ten. That is a behaviour change users need to find without reading a changelog, and TSDoc is where they will meet it — there is no user-facing ORM chaining guide in `docs/` (`docs/reference/query-patterns.md` is the sql-builder DSL).

Three methods, in `src/collection.ts`:

- **`aggregate()`** (`:1103`) — state that it reduces over the rows the chain describes, not every matching row, and that `take` / `skip` / `cursor` / `distinct` / `distinctOn` therefore shape the result. Carry a worked example whose answer differs from the unscoped one, so the semantics are visible rather than asserted.
- **`take()`** (`:955`) and **`skip()`** (`:970`) — note that the window they set applies to whatever terminal follows, aggregates included. Their current TSDoc shows only `.all()` examples, which is exactly the reading this slice invalidated.

## Scope — root position only

`groupBy()` is **out**. The pre-group / post-group distinction does not exist yet: `.take(10).groupBy('x')` still discards the window today, and the grouped terminal still carries an `it.fails` test. Documenting a rule the code does not implement would be worse than documenting nothing.

Do not pre-announce the next slice, either. No "in a future version", no "coming soon" — TSDoc describes what the surface does now.

**Also out:** `distinctOn`'s own TSDoc gained a capability note in D4c; leave it alone. `docs/architecture docs/subsystems/3. Query Lanes.md` was corrected in D4c; leave it alone. No new doc files.

## Completed when

- [ ] `aggregate()`'s TSDoc states the row-scope rule and carries an example where the scoped answer differs from the unscoped one.
- [ ] `take()` and `skip()` note that the window applies to aggregate terminals too.
- [ ] Every code example compiles as written — a TSDoc example that would not typecheck is worse than none, because it will be copied. Check the chains against the real surface rather than composing them from memory.
- [ ] **Baseline snapshot byte-unchanged**, and no `src/` change beyond comment text — this dispatch alters no behaviour.
- [ ] Gates green.

## Validation gates

- `cd packages/3-extensions/sql-orm-client && pnpm typecheck`
- `pnpm --filter @internal/sql-orm-client test`
- `pnpm --filter @internal/sql-orm-client lint`

## Standing instruction

Stay focused on the goal; control scope. Anything that pulls you off the goal halts and surfaces.

## Halt conditions

- A worked example turns out not to compile, or turns out to describe behaviour the code does not have. That is a finding about the *code*, not a prompt to soften the prose — halt and report it.
- 45 minutes.

## House rules that apply

- `.agents/rules/jsdoc-line-width.mdc` — no manual ~80-column wrapping in JSDoc prose; no orphaned doc blocks.
- `.agents/rules/markdown-no-artificial-line-wraps.mdc` in spirit for the prose.
- Match the surrounding voice. `collection.ts:842-972` is the house style for these methods: second person, a short worked example, no hedging.
- Don't add comments if avoidable — but this dispatch *is* the comment, so the rule here is that every sentence earns its place, not that there should be fewer of them.

## References

- Project spec § Project Definition of Done, item 9 — the documentation requirement this closes, and its explicit note that this lands in user-facing ORM docs rather than an ADR, since position-determines-scope is an application of ADR 201 rather than a new decision.
- Slice spec § Open Questions — the standing decision that TSDoc is the user-facing surface here, and that the PR description carries the behaviour-change flag which `draft-release-notes` reads at release-cut time.

## Operational metadata

- **Model tier:** cheap — voice-aware doc edit with an established voice to match and explicit insertion points.
- **Time-box:** 45 minutes.
