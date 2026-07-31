# Brief: D4 — SQLite aggregate matrix and built-in descriptors

## Task

Mirror D3 for SQLite: enumerate the complete built-in SQLite aggregate behaviour by executable probe — `count` (input-agnostic, per the amended spec), `sum`, `avg`, `min`, `max` over each built-in input codec family (integer/bigint, real, numeric-affinity text where applicable, temporal representations for min/max) against a real SQLite database — then author the probed matrix as SQLite target `SqlAggregateDescriptor` contributions and pin it with database-backed conformance tests on the D1 sqlite testkit harness. The settled baseline row: `count` → `sqlite/bigint@1` (declared through the input-agnostic kind D3 added). SQLite's dynamic typing is the hazard: `sum()` returns INTEGER or REAL depending on the inputs' runtime affinity, and `avg()` is always REAL — where an output codec is genuinely input-dependent, the descriptor's declared identity must express it via exact/trait matching per input codec; where the probe shows a result shape the descriptor vocabulary cannot express declaratively, that is a halt (falsified assumption), not a workaround.

## Scope

**In:** SQLite target aggregate descriptor definitions and registration (`packages/3-targets/3-targets/sqlite`); database-backed aggregate conformance tests in the sqlite testkit package (mirroring D3's placement decision); the probe as throwaway evidence.

**Out:** PostgreSQL (D3, done); `aggregateTypes` emission (D5); ORM/sql-builder consumption (D6/D7); any further protocol vocabulary change beyond consuming what D2+D3 shipped (a genuine gap is a halt); SQLite stored scalar arrays (project non-goal).

## Completed when

- [ ] Every built-in SQLite aggregate/input pair either has a descriptor with a database-verified conformance case or is explicitly recorded as unsupported (probe evidence in the test's doc block); the `count` → `sqlite/bigint@1` baseline is pinned by a test that would fail on a wrong output codec.
- [ ] SQLite's `sum` INTEGER-overflow-to-error and REAL behaviours are probed and their descriptor treatment recorded (SQLite raises "integer overflow" on INTEGER sum overflow rather than widening — whatever the probe shows, the descriptor and its test state it).
- [ ] Validation gates green (brief-standard set; `fixtures:check` no-op).

## Standing instruction

Stay focused on the goal; control scope. Trivial-and-related fixes that obviously serve the goal go in the same dispatch with a one-line note. Anything that pulls you off the goal halts and surfaces.

## References

- D3's hand-off: the probe-and-pin pattern, the input-agnostic kind, and the postgres matrix as the shape to mirror (read D3's dispatch report and diff first).
- Slice spec § Aggregate descriptors and resolution (as amended 2026-07-31); design notes § Aggregate descriptors.
- SQLite codec homes: `packages/3-targets/3-targets/sqlite/src/core/codecs.ts`, registry at `src/core/registry.ts`; sqlite testkit at `packages/3-targets/6-adapters/sqlite-codec-testkit`.
- Known trap: `descriptorsFromCodecs` in sql-runtime test utils drops traits; declare descriptors directly.

## Operational metadata

- **Model tier:** `orchestrator` — same judgment class as D3, plus SQLite's dynamic-typing interpretation.
- **Time-box:** 2 hours wall-clock. Overrun → halt and surface.
- **Halt conditions:** probe contradicting the count baseline; a result shape the descriptor vocabulary cannot express declaratively; any need to touch ORM/emitter surfaces or further protocol vocabulary.

## Validation gates

```bash
pnpm build
pnpm typecheck
pnpm lint:deps
pnpm lint --filter <touched>
pnpm test --filter <touched>
pnpm fixtures:check   # no-op
```

Foreground only; long output saved once under `wip/`; environment-blocked classification per the D1 precedent; the known `check:upgrade-coverage` red is D8's, do not chase it.
