# Spec — Slice 1: `indexes-are-name-identified`

**Parent:** [project spec](../spec.md) (decisions D1, D2, D4, D5, D6, D7 govern; D3/D8/D9 are later slices) · [plan](../plan.md) slice 1.

## At a glance

Every SQL index node — declared `@@index`/`constraints.index` and FK-backing — becomes **name-identified**: the contract stores a full physical name on every index, unnamed indexes get an ADR-234 content-addressed wire name (`<default-prefix>_<8hex>`), the diff tree pairs index nodes by name instead of column tuple, introspection captures expression/partial indexes at full fidelity (the skip and dedup hacks are deleted), the planner renders expression DDL and gains `ALTER INDEX … RENAME`, and both rename-pairing phases converge existing databases (scenario I) without rebuilds. **No new authoring parameters** — the existing inputs are re-based onto the two naming modes. Unique *constraints* (`UniqueConstraint`/`SqlUniqueIR`) are untouched (project spec D5).

## Chosen design

### 1. Naming module hoist (D4)

`packages/2-sql/1-core/schema-ir/src/exports/naming.ts` (already exported as `@internal/sql-schema-ir/naming`, currently just `defaultIndexName`) gains:

- `formatWireName(prefix, hash)` / `parseWireName(name)` — moved from `packages/3-targets/3-targets/postgres/src/core/rls/wire-name.ts`, generalized names, same `/^(.+)_([0-9a-f]{8})$/` shape. `wire-name.ts` is **deleted**; call sites updated: `authoring.ts:164` (policy wire-name construction), `migrations/planner.ts` (rename pairing), adapters `control-adapter.ts:1261` (policy prefix extraction), and the `exports/rls-canonicalize.ts` re-exports (no shims — the RLS-specific names go away).
- `normalizeSqlBody(sql)` — moved from `normalizePredicate` in `rls/canonicalize.ts`; that file imports it from the naming module. Same implementation (`trim` + collapse internal whitespace), same stability commitment.
- `computeIndexContentHash(parts)` — first 8 lowercase hex of SHA-256 over `JSON.stringify` of the D4 tuple: `[normalizeSqlBody(expression ?? ''), normalizeSqlBody(where ?? ''), columns ?? [], unique, type ?? '', sortedOptions]` with `sortedOptions` = `[key, String(value)]` pairs sorted by key. Sibling of the RLS `computeContentHash`, which keeps its tuple unchanged.
- Prefix length cap 54 chars, enforced where wire names are constructed, with a clear error (same rule as RLS).

The one hashing subtlety pinned here: `columns` hashes in **authored order** (order is semantic), `options` hash **`String()`-coerced** so the hash computed from typed contract values matches one recomputed from introspected reloptions strings (the same coercion `indexOptionsLooselyEqual` already uses).

### 2. Contract `Index` reshape (D1)

`packages/2-sql/1-core/contract/src/ir/sql-index.ts` per D1: `name` **required** (full physical name), `prefix?` (present ⇔ managed), `columns?` xor `expression?`, `where?`, `unique` required boolean, `type?`/`options?` unchanged. Constructor enforces the D1 invariants (xor; expression ⇒ explicitly named; `prefix` ⇒ `name` parses back to `prefix` + hash). `UniqueConstraint` untouched.

Downstream contract surfaces move with it:

- `storage-entry-schemas.ts:77` `IndexSchema` gains the new fields; `name`/`unique` become required.
- `canonicalization-hooks.ts` — `indexes` stays a sorted array key; new optional keys serialize canonically.
- Emitter `packages/2-sql/3-tooling/emitter/src/index.ts:613–623` — index type literals in `contract.d.ts` carry the new shape.
- `factories.ts` `index(...)` and `storage-table.ts` normalization accept the new input.

**Lowering computes the names.** Both authoring paths (PSL interpreter `contract-psl/src/interpreter.ts:807–976`, TS `contract-dsl.ts` → lowering) and FK materialization (`foreign-key-materialization.ts:96`) emit every index with a full `name`:

| Authoring input today | Slice-1 lowering |
| --- | --- |
| `@@index([a,b])` / `constraints.index([a,b])` (unnamed) | Managed: `prefix = defaultIndexName(table, cols)`, `name = <prefix>_<hash>` |
| FK-backing index (materialized) | Managed: `prefix = <today's default FK-index name>`, `name = <prefix>_<hash>` |
| PSL `@@index([a,b], map: "x")` | **Exact**: `name = "x"`, no `prefix`, no hash — `map:` takes its D3 end-state meaning now |
| TS `constraints.index([a,b], { name: "x" })` | Managed: `prefix = "x"`, `name = "x_<hash>"` — today's TS `name` takes its D3 end-state meaning now |

This is the full slice-1 authoring story: no parameter is added or removed; each existing spelling adopts the meaning D3 assigns it, so slice 2 only *adds* parameters (`expression`, `where`, `unique`, PSL `name:`, TS `map:`, diagnostics, warning). The PSL/TS asymmetry during slice 1 (PSL can author exact, TS can author managed-custom-prefix) is transitional and closes in slice 2.

`unique` is authorable by no surface in this slice (always lowered `false`); it exists in the contract shape because introspection produces it and slice 2 will author it.

### 3. `SqlIndexIR` identity (D5)

`sql-index-ir.ts`: `name` required, `id` = `name` (tuple-derived id and its doc rationale deleted), `prefix?`/`expression?`/`where?` added, `columns` optional (xor expression). `isEqualTo` per the D5 matrix — both modes compare `unique` strict, `type` strict, `options` loose, `columns` ordered-strict when both sides carry them; exact mode (`prefix === undefined` on `this`) additionally byte-compares `expression ?? ''`/`where ?? ''`; managed mode never compares bodies. `dependsOn`: column indexes keep per-column chains; expression indexes stamp chains to every column of the table (deterministic over-approximation, D5).

Consumers updated: `contract-to-schema-ir.ts:259` `convertIndex` (drops the hard-coded `unique: false`, passes the contract entity's fields through), `contract-to-postgres-database-schema-node.ts:197`, `postgres-table-schema-node.ts`, `sql-table-ir.ts` normalization. `SqlUniqueIR` untouched.

### 4. Introspection (D6)

**Postgres** (`6-adapters/postgres/src/core/control-adapter.ts:878–1191`): the query adds `pg_get_expr(ix.indpred, ix.indrelid)` and per-position `pg_get_indexdef(ix.indexrelid, k.ord::int, true)`; an index with any `0` attnum builds as an expression node (`expression` = element defs joined `', '`, `columns` undefined); `where` from the predicate; **`indexNamesWithExpressionKey` and `bestByColumnTuple` are deleted** — every non-constraint-backed index enters the tree keyed by its catalog-unique name; `prefix` stamped from `parseWireName(indexname)?.prefix` (rename-pass grouping only, like policies today). The constraint-backed exclusion (`contype IN ('p','u','x')`) stays — those live objects belong to PK/unique nodes.

**SQLite** (`6-adapters/sqlite/src/core/control-adapter.ts:594–618`): already name-carrying; index nodes now key by name via the shared `SqlIndexIR`. No expression capture (project non-goal). SQLite issue-planner/strategy `defaultIndexName` fallbacks (`issue-planner.ts:221,322,330`, `planner-strategies.ts:153`) are deleted — the node's name is always present. SQLite has no `ALTER INDEX RENAME`; pre-slice databases converge via create (+ drop under destructive) — a documented consequence, not a rename pass.

### 5. Planner (D7)

- `mapIndexNodeIssue` (`issue-planner.ts:811–836`): name always from the node — both `?? defaultIndexName(...)` fallbacks deleted (likewise the `:479` call-site fallback and `control-instance.ts:1115` if it derives identity).
- `CreateIndexCall` (`op-factory-call.ts:1097`): elements become `{ columns } | { expression }`; extras gain `where?`/`unique?`. `operations/indexes.ts` `createIndex` renders `CREATE [UNIQUE ]INDEX "<name>" ON <schema>.<table>[ USING <type>] (<quoted columns | expression verbatim>)[ WITH (…)][ WHERE (<where verbatim>)]` — bodies verbatim, never quoted/escaped, exactly like policy predicate rendering.
- New `RenameIndexCall` + `renameIndex` op, modeled byte-for-byte on `RenamePostgresRlsPolicyCall`/`renameRlsPolicy` (`op-factory-call.ts:1708`, `operations/rls.ts:142`): `ALTER INDEX <schema>."<from>" RENAME TO "<to>"`, `operationClass: 'widening'` (same typology note), precheck from-exists ∧ to-absent, postcheck to-exists, `renderTypeScript` → `this.renameIndex({ schema, table, from, to })`, registered in the op-factory union + runtime factory + classification (`index` bucket).
- **Rename post-pass generalized to indexes** beside the policy pass in `planner.ts:355`: phase 1 hash-pairing (identical algorithm: extras grouped by `(schema, table, parsed hash)`, sorted-name determinism) and phase 2 content-pairing over the remaining managed-missing × any-shape-extras (content-equal per D7: columns ordered-strict both-defined-or-both-undefined, `unique`/`type` strict, `options` loose, bodies byte-equal; missing and candidates iterated in sorted-name order, first match consumed). Runs only under `widening`; leftovers degrade to create/drop exactly as today. The policy pass itself gains **no** phase 2 in this slice (that is slice 3).

### 6. `contract infer` — minimal adaptation only (D8 is slice 4)

Infer already emits `@@index([cols], map: "<live name>")` (`infer-psl-contract.ts:910–924`), which under this slice means **exact mode** — so infer → emit → verify on fields-only indexes stays zero-drift by construction. Two slice-1 adjustments, no more: expression-carrying index nodes are skipped at the infer layer (they previously never reached it; a `// slice-4` note marks the spot), and infer's emitted PSL must keep round-tripping (its own e2e suite decides). Managed re-detection, `unique:`, and policy emission all stay slice 4.

## Coherence rationale

One identity switch, executed at every layer that stores, derives, compares, or names an index node — contract, schema IR, introspection, planner — in one PR. Splitting layers would leave the differ pairing wire-named expected nodes against tuple-keyed actual nodes (or vice versa), which is not a shippable intermediate state. The slice stays reviewable because the authoring surface is deliberately frozen: reviewers check one semantic change propagated through known seams, not new UX.

## Scope

**In:** everything above; fixture/example contract re-emission (36 `contract.json` carry `indexes`; `pnpm fixtures:emit`, storage hashes move — one sweep); test updates across the affected package suites plus `test/integration` + `test/e2e` sweeps.

**Deliberately out:** new authoring parameters, diagnostics, and the D9 warning (slice 2); policy `@@map`/optional-prefix/policy phase-2 pairing (slice 3); infer managed re-detection and policy/`@@rls` emission (slice 4); any change to `UniqueConstraint`/`SqlUniqueIR`/`PrimaryKey`; SQLite expression capture; Mongo.

## Pre-investigated edge cases

| Case | Obligation |
| --- | --- |
| Supabase reference fixture (`packages/3-extensions/supabase`, CI acceptance harness against a real instance) | Names become identity, so any index expectation whose stored name doesn't match the live catalog name **fails after this slice by design**. Re-emit via the checked-in generator path (`contract:generate` / `fixtures:emit`) so every adopted index carries its live name as exact — never hand-edit (repo rule: fix the generator, regen). If the generator synthesizes any default-named FK-backing index that diverges from the live name, that's a generator bug to fix in this slice. |
| Same-tuple twins (scenario J) | Introspection must hand the differ two same-tuple siblings post-dedup-deletion; `control-adapter.test.ts:858–1051` currently pins the dedup behavior and flips. |
| Op-id collisions | `createIndex` op ids embed the index name (`index.<table>.<name>`); wire names keep them unique — no scheme change needed. |
| Rename determinism | Multi-candidate groups pair by sorted name in both phases — property already proven for policies in `rls-rename-planner.test.ts`; port the same cases. |
| `options` hash vs loose equality | Hash uses the same `String()` coercion as `indexOptionsLooselyEqual` so a contract-computed hash and an introspection-recomputed hash (slice 4) agree. |

## Slice-specific done conditions

1. **Scenario I fixture:** a database migrated with the pre-slice toolchain (plain default index names, raw-SQL fixture) + its re-emitted contract → first `widening` plan is **renames only** (byte-asserted `ALTER INDEX` ops); apply; verify clean.
2. **Scenario J test:** unique index + redundant plain same-column index both introspect, both verify.
3. **Expression DDL:** `CreateIndexCall` with expression/where/unique renders byte-asserted DDL in the target/adapter suites and survives the `renderTypeScript` round-trip suites; a `migration plan` e2e drives one expression index end-to-end (contract authored via the factory layer, since PSL expression authoring is slice 2).
4. **Exact-mode round-trip:** infer → emit → verify zero issues / plan zero ops on a database with fields-only custom-named indexes (today's supported adoption flow, preserved).
5. Planner-op byte-identity via target/adapter suites + `migration plan` e2e — **not** `fixtures:check` (recurring trap; fixtures only prove emission).

(CI-green across the full set — build, typecheck, whole Lint job, `fixtures:check`, three test suites — and reviewer accept are inherited, not restated.)

## Open questions

None — D1–D7 answer the rest; deviations discovered mid-build go through discussion, not silent handling.

## References

- Project [spec](../spec.md) §§ D1, D2, D4–D7; [ADR draft](adr-name-identified-indexes.md)
- Grounding: `rls/wire-name.ts`, `rls/canonicalize.ts`, `planner.ts:355–460` (policy rename pass), `issue-planner.ts:811`, `op-factory-call.ts:1097/1169/1708`, `operations/indexes.ts`, `operations/rls.ts:142`, `control-adapter.ts:878–1191` (PG), `control-adapter.ts:594–618` (SQLite), `contract-to-schema-ir.ts:259`, `foreign-key-materialization.ts:96`, `interpreter.ts:807–976`, `contract-dsl.ts:795–975`, `storage-entry-schemas.ts:77`, `canonicalization-hooks.ts`, `emitter/src/index.ts:613`, `infer-psl-contract.ts:910`
