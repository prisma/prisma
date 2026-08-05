# Brief: D3 — PostgreSQL aggregate matrix and built-in descriptors

## Task

Enumerate the complete built-in PostgreSQL aggregate behaviour by executable probe — for each of `count` (no input), `sum`, `avg`, `min`, `max` over each built-in input codec family (int2/int4/int8, float4/float8, numeric, money if applicable, temporal types for min/max) query a real database for the result type and value shape — then author the probed matrix as `SqlAggregateDescriptor` contributions of the PostgreSQL target and pin it with database-backed conformance tests built on the D1 testkit harness and the D2 protocol. The settled baseline rows (design-notes § Aggregate descriptors): `count` → `pg/int8@1`; `sum(int2|int4)` → `pg/int8@1`; `sum(int8)` and integer `avg` → `pg/numeric@1`; `min`/`max` → `self`. The probe fills in every remaining cell; where the probe contradicts a baseline row, that is a falsified assumption — halt and surface, do not adapt silently. Trait fallbacks are permitted only where every matching codec provably shares the same result contract; exact codec overloads otherwise.

## Scope

**In:** PostgreSQL target aggregate descriptor definitions and their registration (`packages/3-targets/3-targets/postgres`); database-backed aggregate conformance tests (extending the postgres testkit's suite or a sibling test file in the testkit package — your call, recorded); the probe itself as throwaway evidence (probe scripts do not ship; their findings appear as the descriptor matrix and its tests); **the input-agnostic match kind** (spec amendment of 2026-07-31, § Aggregate descriptors and resolution): D2 surfaced that `count(x)` matches nothing under the three original kinds, and the spec now adds a fourth — matches with or without input, must name a concrete output codec, consulted after exact and trait. This dispatch adds the kind to the D2 vocabulary/registry (an additive union member + precedence rung + tests) and declares `count` through it — one descriptor covering `count(*)` and `count(x)`.

**Out:** SQLite (D4); `aggregateTypes` emission (D5); ORM/sql-builder consumption (D6/D7); any change to the D2 protocol surface beyond consuming it (a protocol gap discovered here is a halt, not an inline patch); PostGIS/pgvector aggregate contributions (out per spec — the mechanism is proven by registry tests, not extension aggregates).

## Completed when

- [ ] Every built-in PostgreSQL aggregate/input pair either has a descriptor with a database-verified conformance case or is explicitly recorded as unsupported (with the probe evidence in the test's doc block), and the four baseline rows are pinned by tests that would fail on a wrong output codec.
- [ ] Exact-over-trait behaviour is exercised against the real registry at least once (an exact overload shadowing a trait fallback).
- [ ] Validation gates green (brief-standard set; `fixtures:check` must remain a no-op — nothing is emitted yet).

## Standing instruction

Stay focused on the goal; control scope. Trivial-and-related fixes that obviously serve the goal go in the same dispatch with a one-line note. Anything that pulls you off the goal halts and surfaces.

## References

- Slice spec § Aggregate descriptors and resolution (the baseline table); design notes § Aggregate descriptors and emitted aggregate types.
- D2's hand-off: the `SqlAggregateDescriptor` protocol, registry, and contribution channel (read D2's dispatch report and diff).
- D1's hand-off: the postgres testkit harness (`packages/3-targets/6-adapters/postgres-codec-testkit`) and its live-database plumbing.
- PostgreSQL codec homes: `packages/3-targets/3-targets/postgres/src/core/codecs.ts`, registry at `src/core/registry.ts`.
- **Known trap (D2 report):** `descriptorsFromCodecs` in `packages/2-sql/5-runtime/test/utils.ts:243` silently drops codec traits (`defineTestCodec` never sets them). Do not rely on stub-synthesized descriptors for trait-matching tests — declare descriptors directly, as D2's tests do.

## Operational metadata

- **Model tier:** `orchestrator` — the matrix is judgment (probe interpretation, trait-vs-exact calls); the descriptor authoring is mechanical once probed.
- **Time-box:** 2 hours wall-clock. Overrun → halt and surface.
- **Halt conditions:** a probe result contradicting a settled baseline row; a D2 protocol gap (e.g. a result shape the descriptor vocabulary cannot express declaratively); any need to touch ORM/emitter surfaces.

## Validation gates

```bash
pnpm build
pnpm typecheck
pnpm lint:deps
pnpm lint --filter <touched>
pnpm test --filter <touched>
pnpm fixtures:check   # no-op
```

Foreground only; long output saved once under `wip/` and read from the file; environment-blocked classification per the D1 precedent if pure-timeout failures recur under host load.
