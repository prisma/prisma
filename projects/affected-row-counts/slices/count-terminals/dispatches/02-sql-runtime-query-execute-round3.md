# Brief: D2 Round 3 — close two retired terms

## Task

Resolve the remaining F3 wording in exactly two D2-touched test descriptions by naming row execution `query` rather than `execute`.

## Scope

**In:** `packages/2-sql/5-runtime/test/async-iterable-result.test.ts:87` and `packages/2-sql/5-runtime/test/marker-verification.test.ts:350`.

**Out:** Any production change, other wording cleanup, D6 fixtures, architecture or behavior changes.

## Completed when

- [ ] Both descriptions use the settled row-query vocabulary and F3's cited residuals are gone.
- [ ] The two focused test files and SQL-runtime lint pass.
- [ ] The change is a signed, explicitly staged commit.

## Operational metadata

- **Model tier:** mid — mechanical two-site correction on an established pattern.
- **Time-box:** 10 minutes.
- **Halt conditions:** Either cited site is not a row-query description; any production change is required; destructive git would be required.
