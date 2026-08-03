# Dispatch plan — `infer-native-enum-adoption`

**Spec:** [`spec.md`](spec.md). Sequential, test-first (repo rule: tests before implementation).

## D1 — `introspect-enum-values`

- **Outcome:** the Postgres control adapter's introspection returns each namespace's native enum types **with ordered member values** (`pg_enum` joined on `enumsortorder`), carried on `PostgresNamespaceSchemaNode` as `{ typeName, values }` entries, while every existing reader of the names-only view (differ carry-through, planner codec hooks, infer annotations, verify) keeps working unchanged.
- **Builds on:** — (main).
- **Hands to:** rich enum data on the introspected schema tree, for D2b to thread into the printer.
- **Focus:** the SQL enrichment in [`control-adapter.ts`](../../../../packages/3-targets/6-adapters/postgres/src/core/control-adapter.ts) (~1126); the node shape in `postgres-namespace-schema-node.ts` + its construction sites (`diff-database-schema.ts`, `verify-postgres-namespaces.ts`, `contract-to-postgres-database-schema-node.ts` keep `[]`-equivalents). Tests: node unit test; adapter integration test introspecting a DB with `CREATE TYPE … AS ENUM` (values in declared order, not alphabetical).
- **Completed when:** adapter integration test proves ordered values per type; `pnpm build` + affected package tests green; no reader call-site broken (`pnpm typecheck`).

## D2a — `psl-writer-native-enum-emission`

- **Outcome:** given enum definitions (`EnumInfo.definitions`), the PSL inference writer emits `native_enum <Name> { member = "value" … @@map }` blocks (top-level name transforms, member-name sanitization with explicit values) and resolves enum-typed columns to `pg.enum(<Name>)` type-constructor fields — exercised through the printer/document-AST layer with hand-fed `EnumInfo`, independent of live introspection.
- **Builds on:** — (main; the `EnumInfo`/`enumNameMap` seams already exist, dead-wired).
- **Hands to:** a printer that renders adoptable PSL when fed enum definitions; D2b feeds it real data.
- **Focus:** wiring `PslPrinterOptions.enumInfo` → block AST + `enumNameMap`; the `pg.enum(Name)` **call-syntax** field type (not bare-name substitution); name-collision handling via the existing top-level name registry (`buildTopLevelNameMap` kind `'enum'`); the enum-array and enum-default edge cases from the spec (settle emit-vs-diagnostic for arrays against what Phase-1 authoring accepts). Tests: `print-psl.enums.test.ts` inverts from asserting the throw to asserting emission (keep one negative for whatever remains unsupported).
- **Completed when:** printer tests prove block + column emission incl. `@@map`, sanitized members, collision case; emitted PSL for the `aal_level` shape parses via `@internal/psl-parser`.

## D2b — `infer-pipeline-adoption`

- **Outcome:** `contract infer` no longer throws on native enum types: it threads D1's introspected `{ typeName, values }` through D2a's printer seams, subtracts pack-owned enum types via the existing `describedContracts` owners lookup (matching on **type name**, per the spec's coordinate-mismatch edge case), and the old remediation text is gone (transitional managed-grade gap documented in its place).
- **Builds on:** D1 (rich tree), D2a (printer).
- **Hands to:** an end-to-end infer path for D3 to prove live.
- **Focus:** [`infer-psl-contract.ts`](../../../../packages/3-targets/3-targets/postgres/src/core/psl-infer/infer-psl-contract.ts) throw site (~291) + `buildPslDocumentAst` threading (~389, 397); `extractEnumInfo` populating `definitions`; owners subtraction. Tests: infer unit tests (adoption, subtraction, name transforms through the full infer entry).
- **Completed when:** infer unit tests prove adoption + pack subtraction; no `new Map()` dead-wiring remains on the enum seams; `pnpm typecheck` green.

## D3 — `live-roundtrip-and-bookkeeping`

- **Outcome:** the slice-DoD holds live: a PGlite integration test infers a database containing native enum types + enum-typed columns (incl. the non-`public` `auth.aal_level` shape within its namespace), the emitted `contract.prisma` parses/builds, and authored back it passes `db verify` against the source DB with columns typed as the value union. Project bookkeeping lands: [`plan.md`](../../plan.md) gains this slice and corrects the stale TML-2981/TML-2965 statuses (both merged); `pnpm fixtures:check` clean.
- **Builds on:** D1 + D2a + D2b.
- **Hands to:** the shipped capability; PR-open.
- **Focus:** integration test under `test/integration/` (follow the existing infer integration precedents); full gates: `pnpm build`, `pnpm typecheck`, Lint job (`lint:casts`, `lint:deps`, `lint:framework-vocabulary`), `pnpm fixtures:check`, package + integration suites. Plus a carry-over from D1 review: harden the adapter's `name[]` parsing (`parsePgNameArray`) to honor Postgres array-literal quoting — an enum label containing a comma, quote, backslash, or significant whitespace (e.g. `in progress`) is silently corrupted today — with a unit test on the string-parse branch using a special-char label. Related (from D2a review, same hardening family): the `@@map` escape/unescape pair is asymmetric for type names containing backslashes (pre-existing `unwrapQuotedString` limitation) — fix or explicitly document alongside.
- **Completed when:** all gates green, run and read by the orchestrator, not asserted by the implementer.
