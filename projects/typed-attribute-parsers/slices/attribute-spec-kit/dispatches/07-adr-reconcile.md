# Brief: D7 — reconcile ADR 231 with the shipped `oneOf`/`identifier` design

> Fresh implementer. Documentation-only dispatch on the slice-1 PR branch. Editing the architecture doc `docs/architecture docs/ADR 231 - Declarative attribute specifications.md` is operator-authorised (overrides the `AGENTS.md` "ask first" default for this edit). Do NOT push or touch GitHub.

## Why
The shipped kit replaced the bespoke `enumOf` combinator with **composition**: enums are now `oneOf` over per-member matchers — `identifier(name)` for bare-identifier members, and pinned `str(value)` / `num(value)` for quoted-string / number-literal members. ADR 231 still documents `enumOf` throughout. Update the ADR so it matches what shipped (ADR principle #4, "compose, don't special-case", taken to its conclusion: there is no enum leaf).

## The shipped design (what the ADR should now say)
- **No `enumOf` combinator.** An enum is expressed by `oneOf` over matchers:
  - `identifier('Cascade')` — matches the bare identifier `Cascade` (typed `ArgType<'Cascade'>`).
  - `str('text')` — matches the quoted string `"text"`; `str()` (no arg) remains the open "any string literal" matcher.
  - `num(1)` / `num(-1)` — matches a specific number literal.
  - (No `bool` matcher — not needed.)
- A bare-identifier enum (referential actions): `oneOf(identifier('NoAction'), identifier('Restrict'), identifier('Cascade'), identifier('SetNull'), identifier('SetDefault'))`.
- A mixed quoted-string/number set (Mongo index `type`): `oneOf(num(1), num(-1), str('text'), str('2dsphere'), str('2d'), str('hashed'))`. The quoted-vs-bare surface is now **explicit per member** (`str('text')` vs `identifier('Cascade')`), which is strictly more precise than `enumOf` guessing from the member's JS type.
- `oneOf` (already in the ADR) is the sum: ordered try-each over `Result`-pure leaves, first success wins, one aggregate `expected one of …` diagnostic on total failure. Its output type is the union of the alternatives' output types — so an editor can still enumerate the legal completions (each alternative is a pinned matcher with a known value).

## Edits to make (find every `enumOf` mention; these are the known sites — search for `enumOf` to be exhaustive)
1. **§ At a glance** — the `sqlRelation` code sample: `onDelete`/`onUpdate` change from `optional(enumOf('NoAction', …))` to `optional(oneOf(identifier('NoAction'), identifier('Restrict'), identifier('Cascade'), identifier('SetNull'), identifier('SetDefault')))`. Update the `InferAttr` comment block if it references the enum shape (the union type is unchanged).
2. **§ At a glance** narrative ("Notice three things…") — where it lists `enumOf(...)` as an example combinator, replace with the `oneOf(identifier(...))` composition; keep the point that the value types are combinators.
3. **§ At a glance** — "because `onDelete` is declared as `enumOf(...)`, the editor can complete its values" → reframe: declared as `oneOf(identifier('NoAction'), …)`, the editor enumerates the alternatives' pinned values.
4. **§ The combinator kit → Scalars** — the sentence introducing `enumOf(...values)` and the Mongo `enumOf(1, -1, 'text', …)` example. Replace with the `str(value?)` / `num(value?)` / `identifier(name)` matchers and the `oneOf(...)`-composes-enums explanation; Mongo index `type` becomes the `oneOf(num(1), num(-1), str('text'), …)` form. Note `str()` open vs `str(value)` pinned.
5. **§ One spec, two consumers (language-server)** — the `enumOf('NoAction', …)` completion example → `oneOf(identifier('NoAction'), …)`; the editor still derives completions from the alternatives' pinned values.
6. **§ Alternatives considered → "Separate `enumOf` and `numEnum`"** — this rejected-alternative is now obsolete (there is no enum leaf at all). Replace it with a rejected-alternative entry that records the actual decision: **"A dedicated `enumOf` leaf"** — rejected in favour of `oneOf` over `identifier` / pinned `str` / `num`, because composition (principle #4) expresses homogeneous and mixed sets uniformly, makes the quoted-vs-bare surface explicit per member, and reuses the `oneOf` sum the design already needs for `@default` and index elements. (Preserve the insight that mixed string/number sets must be expressible — now via `oneOf(num(...), str(...))`.)
7. **§ References (ADR 224 line)** — `@@control(...)` "value set this design types as `enumOf('managed', 'tolerated', 'external', 'observed')`" → `oneOf(identifier('managed'), identifier('tolerated'), identifier('external'), identifier('observed'))`.
8. Any other `enumOf` occurrence the search turns up — reconcile consistently.

## Scope
**In:** `docs/architecture docs/ADR 231 - Declarative attribute specifications.md` only — prose + code samples reconciled to the `oneOf`/`identifier`/`str`/`num` design. **Out:** code, tests, other docs, ADR status line (leave `Status: Proposed` as-is unless it already says otherwise — implementation tracking is a close-out concern). Do not invent design beyond what's described here; if you find an `enumOf` use case this model can't express, **halt and surface** rather than guessing.

## Completed when
- [ ] `rg "enumOf" "docs/architecture docs/ADR 231 - Declarative attribute specifications.md"` → zero.
- [ ] Every code sample + narrative uses `oneOf` / `identifier` / `str` / `num` consistently; the doc reads coherently (no dangling references to a removed leaf).
- [ ] No other file changed.

## Constraints
- Markdown only; no code/test changes. Follow `markdown-no-artificial-line-wraps` (don't hard-wrap prose). Explicit-staging commit (`git add` the ADR path only), no amend, **no push**. Do NOT touch GitHub. Transient-ID scan is N/A (no source), but don't introduce `projects/…` paths into the ADR.

## Operational metadata
- **Model tier:** mid (bounded doc reconciliation, but requires faithful design understanding).
- **Halt conditions:** an `enumOf` use case that `oneOf` + the matchers can't express; any temptation to change code/tests to match the doc (the doc follows the code, not vice-versa).

Return: the list of sites changed, the `rg enumOf` result, and the commit SHA.
