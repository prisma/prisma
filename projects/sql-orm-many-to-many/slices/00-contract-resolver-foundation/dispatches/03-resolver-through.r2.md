# Brief: D3 R2 — clear F1 (bare casts in `resolveThrough`)

## Task

R1 (commit `3a87c7c55`) landed the `through` descriptor correctly — AC-2 is PASS. One blocking finding remains:

**F1 (must-fix):** `resolveThrough` in `packages/3-extensions/sql-orm-client/src/collection-contract.ts` introduced **5 new bare `as` casts** in production (≈ lines 274–275 and 289–291): `parentColumns as string[]` and `childColumns as string[]` in the `Set` spread, and `parentColumns/childColumns/targetColumns as readonly string[]` in the return object. After the `Array.isArray()` guard the inferred type is `unknown[]`; the contract validator guarantees `string` elements, so these are declarative widenings. They would fail the `no-bare-cast` Biome plugin + the `pnpm lint:casts` ratchet (HEAD cast count > merge-base).

Replace all 5 with `castAs<readonly string[]>(…)` (import `castAs` from `@internal/utils/casts`) — the declarative-widening helper is exactly the right tool since the value already satisfies the type. If a small element-type narrowing helper reads cleaner and removes the casts entirely, that's also acceptable — your call.

## Scope

**In:** the 5 cast sites in `resolveThrough` (and the `castAs` import). Nothing else — the logic, tests, and `through` shape are already accepted.

**Out:** any behaviour change; the tests (they pass); any other file.

## Completed when

- [ ] No bare `as` casts remain in `resolveThrough` (the test-file `as unknown as Contract<…>` is exempt and out of scope).
- [ ] Gate: `pnpm --filter @internal/sql-orm-client typecheck` + `test` still green.
- [ ] Gate: `pnpm lint:casts` passes (the ratchet does not report an increase from this branch's casts).

## Standing instruction

Surgical fix — touch only the 5 cast sites + the import. Do not re-open the accepted logic.

## References

- Finding F1 in `projects/sql-orm-many-to-many/reviews/code-review.md § Findings log` — exact locations + recommended action.
- `.agents/rules/no-bare-casts.mdc` — the rule + the `castAs`/`blindCast` decision tree.
- R1 commit: `3a87c7c55`.

## Operational metadata

- **Model tier:** cheap/mid — surgical, well-specified fix.
- **Branch:** `tml-2784-slice-0-contract-resolver-foundation`. New commit (do not amend `3a87c7c55`). Explicit staging + `-s` sign-off. **Do not push.**
- **Time-box:** ~20 min.
- **Halt conditions:** if `castAs<readonly string[]>` doesn't satisfy the type (e.g. the value is genuinely wider than `readonly string[]`), surface rather than reaching for `blindCast` or a wider cast.
