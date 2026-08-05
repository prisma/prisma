# Dispatch plan — 07-contributed-aggregate-operations

**Slice spec:** [`spec.md`](./spec.md)
**Linear:** [TML-3164](https://linear.app/prisma-company/issue/TML-3164/contributed-aggregate-operations-de-hardcode-the-sql-builder-and-orm)
**Branch:** `tml-3164-contributed-aggregate-operations`, based on the shared planning commit atop `main` (slice 5 merged as prisma/prisma#29867). Parallel with slice 06 (`tml-3163-…`, PR #29902, in flight); the two share no implementation surfaces. `projects/**/trace.jsonl` will conflict trivially at merge time — resolve by line union.

## Validation gate

Every dispatch runs this gate. The test filter is derived from the diff at each run — `git diff --name-only main...HEAD` mapped to owning packages — plus the standing floor below.

```bash
pnpm build
pnpm typecheck
pnpm lint:deps
pnpm lint --filter <touched packages>
pnpm test --filter <every package the diff touches> --filter @internal/integration-tests
pnpm fixtures:check
pnpm check:upgrade-coverage
```

Standing floor regardless of diff: `@internal/sql-orm-client`, the sql-builder lane package, relational-core, framework-components, `@internal/integration-tests`, both targets (their contributions are the vocabulary's source). **The slice's star gates:** `pnpm fixtures:check` passes with **zero fixture movement across the whole slice** (behaviour-preserving; emitted contracts byte-identical), and the operation-literal greps below return empty. `pnpm lint` is a separate CI job — run it, not just typecheck ([F14](../../../../drive/calibration/failure-modes.md#f14-dispatch-reports-validation-green-but-ci-is-red-dispatch-gates-didnt-mirror-ci)). Failures classified against pristine main before "pre-existing" is accepted ([F25](../../../../drive/calibration/failure-modes.md#f25-pre-existing-failure-claim-accepted-without-running-the-suspect-file-on-pristine-main)); fresh `pnpm build` before judging any red ([F24](../../../../drive/calibration/failure-modes.md#f24-stale-dist-makes-a-red-gate-look-like-a-broken-base)). Known host-environment noise (baselined during slice 06): `issues-28192-pg-historical-dates` (host timezone), `init-journey.e2e` (host pnpm), shifting migration-e2e timeout/ECONNRESET sets under parallel load (contention — rerun in isolation). Slice 06's gate may run concurrently on this host — stagger heavy suites when a run looks oversubscribed.

## Calibration references (slice-DoR plan-side items)

- Failure modes threaded into briefs where named: [F1](../../../../drive/calibration/failure-modes.md#f1-dual-shape-support-relocated-under-a-new-name) (a deleted literal-name dispatch path must not survive relocated under a new name — the derivation replaces it, it does not wrap it), [F3](../../../../drive/calibration/failure-modes.md#f3-discovery-via-test-suite-instead-of-grep) (enumerate every operation-literal consumer by grep before cutting), [F13](../../../../drive/calibration/failure-modes.md#f13-regression-test-for-a-boundary--scoping-property-doesnt-discriminate) (the extensibility proof must fail without the contribution — assert the method is absent from a contract lacking the operation).
- Grep library: [test-literal hygiene](../../../../drive/calibration/grep-library.md#test-literal-hygiene). Slice-specific retired-literal greps: `rg -n "'(count|sum|avg|min|max)'" packages/3-extensions/sql-orm-client/src packages/2-sql/4-lanes/sql-builder/src` (dispatch literals; type-test and doc-comment hits exempt by inspection) and `rg -n "createIncludeScalar\('"` (no literal-name call sites).

## Shape

The vocabulary opens first (substrate), then the two consumer cuts — lane, then ORM (the larger) — then the extensibility proof and the durable record. Each cut is behaviour-preserving in isolation, so every merge state is coherent. The judgment lives in D1 (validation semantics) and D3 (the derived surface's type-level shape); D2 is a contained cut; D4 is proof and record.

### Dispatch 1: Open the operation vocabulary

- **Outcome:** `AggregateDescriptor.operation` (framework-components `shared/aggregate-descriptor.ts`) and the SQL specialization/registry (`packages/2-sql/4-lanes/relational-core/src/aggregate-descriptor{,-registry}.ts`) accept arbitrary `string` operation names; the AST union `AggregateFn` (`relational-core/src/ast/types.ts:15-16`) is untouched and stays closed. Composition-time validation enforces the lowering rule: an operation whose name is in the AST alphabet lowers to `AggregateExpr(name, expr)` by default; any other name must carry a `lower` hook, and composition fails with a structured error if it does not. Registry unit tests cover open names, the lowering rule, and unchanged exact-over-trait-over-any precedence. Every existing consumer compiles and behaves identically (the five built-in names are still strings); emitted contracts are byte-identical.
- **Builds on:** The spec's chosen design; slice 5's registry and validation precedent (`ControlStack` single-contributor validation, `settleAggregateOverloads`).
- **Hands to:** An open-vocabulary registry with enforced lowering semantics — the substrate both consumer cuts derive from.
- **Focus:** Types, validation, and registry only. No consumer changes. Where the widening surfaces a latent type-level dependency on the closed union in a consumer, note it for D2/D3 rather than fixing it here unless the build breaks — mechanical `string` accommodations are permitted to keep the gate green.

### Dispatch 2: The sql-builder lane derivation

- **Outcome:** The sql-builder lane's aggregate function surface (`packages/2-sql/4-lanes/sql-builder/src/expression.ts`, `src/runtime/functions.ts`) derives from the contract's `aggregateTypes` and the lane registry: no hardcoded operation list, no per-operation special logic; the call-shape rule (a `withoutInput` row ⇒ zero-arg callable; `byCodec`/`anyInput` rows ⇒ field-taking; both ⇒ both) is derived from row presence. Rendered SQL and all results are byte-identical; the lane's existing tests pass unchanged; the operation-literal grep over `sql-builder/src` returns empty.
- **Builds on:** D1's open registry and lowering rule. The type-level machinery (`AggregateField`, `AggregateRow`) is already generic over `Op extends string` — this dispatch is primarily the runtime surface.
- **Hands to:** One of the two consumers cut over; the derivation pattern D3 mirrors at larger scale.
- **Focus:** The lane only. No ORM changes.

### Dispatch 3: The ORM cut

- **Outcome:** sql-orm-client's aggregate surfaces — the include-refinement reducers (`src/collection.ts`, the literal `count`/`sum`/`avg`/`min`/`max` methods and `createIncludeScalar('…')` calls), the top-level and grouped `AggregateSelector` surfaces (`src/types.ts`), and the grouped `.aggregate()` builder — become one mapped-type surface over `AggregateTypesOf<TContract>` with generic name-keyed runtime dispatch (the proxy pattern the client already uses for model access, unless the proxy defeats type-level narrowing — then generated methods, decision recorded). Reserved-name validation rejects a contributed operation that would shadow a non-aggregate builder member, with a structured error at ORM composition. Every existing call site compiles unchanged; all sql-orm-client and integration aggregate tests pass unchanged; the operation-literal and `createIncludeScalar('` greps return empty; fixtures byte-identical.
- **Builds on:** D1's registry; D2's derivation pattern. Non-linear edge: D3 reads D1's registry surface directly, not through D2.
- **Hands to:** No hardcoded aggregate knowledge anywhere in the client — the slice's headline claim.
- **Focus:** The ORM cut, whole: one derivation replacing every literal surface is one behavioural claim (behaviour-preservation), per the surgical-substrate-change pattern. If mid-dispatch the surface proves too large for one executor session (_Small_ fails in practice), the seam to split at is include-reducers vs top-level/grouped — halt and report rather than shipping half.

### Dispatch 4: Extensibility proof and the record

- **Outcome:** A registry + type test contributes a hypothetical operation (a descriptor with a `lower` hook building slice-1 function nodes) and proves it surfaces as a typed method with the right result type and arity on the collection surface — and is absent for a contract lacking the operation (F13); the reserved-name rejection is negatively tested. ADR 020 is extended with the contributed-operation semantics (open namespace, closed SQL alphabet, lowering rule, reserved names); the aggregate descriptor guide's contribution section reflects the same; the full slice-scope gate passes including both star gates.
- **Builds on:** Everything prior.
- **Hands to:** Slice close — reviewer verdict, PR against `main` (title carries TML-3164), then slice 08 pickup once slice 06 has also merged.
- **Focus:** Proof and record. The proof exercises the mechanism without shipping a production extension aggregate (mirrors slice 5's choice).

## Open items

- Spec open questions land as follows: Q1 (proxy vs generated methods) → D3, decision recorded in the dispatch report; Q2 (reserved-name validation home — working position: ORM composition, not `ControlStack`) → D3.
- Model tier per `drive/calibration/model-tier.md` at brief-assembly time: D1/D3 carry the judgment; D2 is a contained cut; D4 is proof/record-shaped.
- Coordination: slice 06 may merge mid-slice; a rebase onto post-merge `main` should be routine (no shared implementation surfaces; `trace.jsonl` unions).

## Hand-off linearity

D2 and D3 both build on D1 (D3 on D1 directly, not on D2's hand-off — the non-linear edge worth naming); D2 before D3 by convention so the smaller cut proves the derivation pattern first. D4 needs D1–D3.

## Completeness against slice-DoD

Operation-literal greps empty — D2 (lane) + D3 (ORM). Fixtures byte-identical — every dispatch's gate, asserted finally at D4. Extensibility proof — D4. ADR/guide record — D4. The spec's "existing call sites compile unchanged" claim — D2/D3 gates (no test-file churn beyond mechanical type-shape updates, each classified in the dispatch report).
