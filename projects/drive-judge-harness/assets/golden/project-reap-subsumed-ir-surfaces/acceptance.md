# Acceptance set — project-reap-subsumed-ir-surfaces

## Expected triage verdict

`project`. The work is several distinct deletions across the framework and both family packs,
each its own reviewable/rollback unit with its own grep gate. It is more than one coherent PR
(multiple disjoint surfaces, multiple reviewer sittings) but is **not** open-ended research.

## Expected planning behaviour (this is a planner test)

- **PA-1** — The plan decomposes the work into **roughly three slices**, one per redundant
  surface: (a) construction-discipline shims, (b) canonicalizer family hook, (c) migration
  aggregate → `elementCoordinates`.
- **PA-2** — The plan recognises the slices touch **disjoint files with no ordering
  dependency** and schedules them to run **in parallel**, rather than needlessly serialising
  them. (Defaulting to a serial chain here is a planning-quality miss.)
- **PA-3** — The plan keeps the structurally-coupled surfaces **out of scope** (the namespaced
  `table` coordinate / hash-shape churn, the kind-agnostic hash computation, and the
  query-builder unbound-tables rewrite) and records them as deferred follow-ups rather than
  pulling them in.

## Expected outcome / requirements

- **AC-1** — The construction shims are deleted: the `*NamespacePayload` POJO types,
  `normaliseNamespaceEntry`, and the default-namespace singleton are gone; `SqlStorage` /
  `MongoStorage` constructors require fully-constructed `Namespace` instances (no POJO
  coercion, no default injection).
- **AC-2** — Family-specific canonicalization (preserve-empty guards, index/unique sorting)
  lives in the SQL/Mongo packs and is threaded into the framework canonicalizer as optional
  hooks; the framework canonicalizer no longer hardcodes `tables`/`indexes`/`uniques`/
  `foreignKeys` path knowledge.
- **AC-3** — The canonicalizer change is **output-preserving**: canonical serialization and
  the storage hash are byte-for-byte unchanged (`pnpm fixtures:check` clean, no hash diffs).
- **AC-4** — The migration aggregate helper's callers walk via `elementCoordinates`; the
  helper is deleted and the `StorageBase`/`Storage` type gap is resolved without a cast.
- **AC-5** — Each slice carries a **deletion grep gate** showing its reaped symbols no longer
  appear in `packages/`.
- **AC-6** — The deferred surfaces are untouched and recorded as follow-ups.

## Correctness oracle

- **Mechanical (per slice):** `pnpm typecheck` · `pnpm test:packages` · `pnpm test:integration`
  · `pnpm fixtures:check` · `pnpm lint:deps`, plus the slice's deletion grep gate.
- **Requirements:** AC-1…AC-6 against the merged result.
- **Intent / design quality:**
  - The end state is that `elementCoordinates(storage)` is the canonical walk and the
    asymmetry-driven helpers it subsumed are gone — not merely deprecated or wrapped.
  - Family-specific knowledge ends up in the family packs, not the framework. The framework
    canonicalizer becomes target-agnostic; SQL/Mongo asymmetry (empty collections vs tables)
    is preserved *via the family hooks*, not via framework-side special-casing.
  - The output-preserving constraint (AC-3) is honoured: a run that "simplifies" the
    canonicalizer but moves the hash has broken the contract, even if tests outside
    `fixtures:check` pass.

## Failure modes a correct run avoids

- Serialising the three independent slices into a dependency chain (slower, no benefit).
- Pulling a deferred structural surface into scope (hash-shape churn, query-builder rewrite)
  and ballooning the project.
- Leaving a shim "deprecated" / wrapped instead of deleted (the grep gate must come back
  empty).
- Moving the canonical hash while refactoring the canonicalizer (AC-3 violation).
- Resolving the `StorageBase`/`Storage` gap with a cast instead of a real type fix.

## Reference

See `reference.md` — the known-good resolution shipped as PRs #630, #631, #629 (all TML-2727).
