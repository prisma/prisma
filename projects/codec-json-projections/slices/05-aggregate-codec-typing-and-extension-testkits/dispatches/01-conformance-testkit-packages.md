# Brief: D1 — conformance testkit packages

## Task

Extract the codec-conformance harnesses that live as test-internal files in `packages/3-targets/6-adapters/postgres/test/codec-conformance/{harness,cases}.ts` and `packages/3-targets/6-adapters/sqlite/test/codec-conformance/{harness,cases}.ts` into two new published, dev-only, test-framework-independent workspace packages — `@internal/postgres-codec-testkit` and `@internal/sqlite-codec-testkit` — and migrate every consumer onto them: the built-in adapter conformance suites, `packages/3-extensions/pgvector/test/codec-conformance.integration.test.ts`, and `packages/3-extensions/arktype-json/test/codec-conformance.integration.test.ts` (both currently reach across package boundaries with `../../../3-targets/6-adapters/postgres/test/codec-conformance/harness` relative imports). The harness's dependencies on adapter internals (`renderLoweredSql` from `adapter-postgres/src/core/sql-renderer`, the adapter contract types) become narrow export subpaths on the adapter packages rather than copied source. The SQLite case type gains the `descriptor?` escape hatch the PostgreSQL case type already has (spec open question 4's working position), proven by a case that runs an unregistered descriptor.

The built-in `cases.ts` catalogues stay with their adapter suites if they are adapter-specific test data, or move to the testkit if they are reusable vocabulary — decide by what an extension author needs: the *harness, case types, and runner* are the public API; the built-in case list is the adapter's own suite content. Record the call in your report.

## Scope

**In:** the two new packages (placement within `packages/3-targets/` per `architecture.config.json` layering — registering the new packages in that config is in scope, as is the pnpm workspace/lockfile update via `pnpm install`); narrow export subpaths on `@internal/adapter-postgres` / `@internal/adapter-sqlite` for what the harness genuinely needs; import migration in the four consuming test suites; the SQLite `descriptor?` hatch; package READMEs (short, factual).

**Out:** anything aggregate (no `SqlAggregateDescriptor`, no matrix work — D2–D4); ORM or sql-builder surfaces; docs beyond the package READMEs; any change to what the harness asserts (extraction, not redesign); PostGIS (TML-3105).

## Completed when

- [ ] `grep -rn "6-adapters/.*/test/codec-conformance" packages/` returns no cross-package relative import; pgvector, arktype-json, and both adapter suites import from `@internal/{postgres,sqlite}-codec-testkit`.
- [ ] Both testkit packages build with tsdown, carry publishable metadata modelled on `@internal/target-sqlite` (Apache-2.0, `files`, exports map with dual `types`/`import` entries), and `pnpm lint:deps` proves no production package depends on either testkit.
- [ ] A SQLite conformance case passing an unregistered `descriptor?` runs green, mirroring the PostgreSQL escape hatch.
- [ ] Full validation gate green (see § Validation gates); `pnpm fixtures:check` unchanged (this dispatch moves no codec behaviour).

## Standing instruction

Stay focused on the goal; control scope. Trivial-and-related fixes that obviously serve the goal go in the same dispatch with a one-line note in your wrap-up message. Anything that pulls you off the goal — even if it looks useful — halts and surfaces.

## References

- Slice spec: `projects/codec-json-projections/slices/05-aggregate-codec-typing-and-extension-testkits/spec.md` — § Conformance testkits, open questions 3–4 (working positions: adapter export subpaths; SQLite `descriptor?` hatch).
- Slice plan entry: `projects/codec-json-projections/slices/05-aggregate-codec-typing-and-extension-testkits/plan.md` § Dispatch 1.
- Project spec: `projects/codec-json-projections/spec.md` — cross-cutting requirement "Clean dependency boundaries"; non-goal "Production dependencies on conformance tooling".
- Packaging precedent: `test/utils/package.json` (`@repo/test-utils` — dev-only content conventions) and `packages/3-targets/3-targets/sqlite/package.json` (`@internal/target-sqlite` — publishing metadata).
- Calibration: [F16](../../../../../drive/calibration/failure-modes.md) (testkit dependency direction is a layering claim; `lint:deps` is its gate), [F24](../../../../../drive/calibration/failure-modes.md) (new packages → fresh `pnpm build` before judging any red), [F14](../../../../../drive/calibration/failure-modes.md) (`pnpm lint` is a separate CI job; test tsconfigs compile too).
- **Inherited trap (slice 4 D3 review, verbatim):** the `decodeJson(null)` guard lives in the runtime (`collection-dispatch` short-circuits null at three shapes), **not** at the codec boundary. A public testkit calling `decodeJson` directly over harness cases has no such short-circuit, so a null case routed through it meets codec strictness and throws. Not a defect anywhere today; null handling is the harness's job (`nullValue` cases), not the codec's. Do not "fix" codecs to accept null.

## Operational metadata

- **Model tier:** `mid` — extraction against two established precedents; the one judgment site (export subpaths, package placement) is narrow and pattern-bound.
- **Time-box:** 90 minutes wall-clock. Overrun → halt and surface, do not extend.
- **Halt conditions:** the testkits cannot be placed without restructuring `architecture.config.json` beyond registering two new packages; the harness needs more adapter internals than a narrow export subpath can carry; any production package would need a testkit dependency to compile; the diff starts touching aggregate or ORM surfaces.

## Validation gates

```bash
pnpm install                      # lockfile moves only for the new packages
pnpm build
pnpm typecheck
pnpm lint:deps
pnpm lint --filter @internal/postgres-codec-testkit --filter @internal/sqlite-codec-testkit --filter @internal/adapter-postgres --filter @internal/adapter-sqlite --filter @internal/pgvector --filter @internal/arktype-json
pnpm test --filter @internal/adapter-postgres --filter @internal/adapter-sqlite --filter @internal/pgvector --filter @internal/arktype-json --filter @internal/integration-tests
pnpm fixtures:check
```
