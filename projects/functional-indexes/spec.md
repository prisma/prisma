# functional-indexes

Expression (functional) indexes — `CREATE INDEX users_email_eq ON users USING btree (eql_v3.eq_term(email))` — are not expressible in Prisma Next: the index IR, both authoring surfaces, and the DDL renderer only know column tuples, and introspection silently discards any live index with an expression key. The blocker has always been comparison: Postgres reprints stored SQL bodies (casts, parens, whitespace), so body equality is unreliable. This project extends the content-addressed wire-name identity model ([ADR 234](../../docs/architecture%20docs/adrs/ADR%20234%20-%20Content-addressed%20wire%20names%20for%20Postgres-normalized%20objects.md)) from RLS policies to **all indexes**, adds an **exact-name mode** (`map:`) whose equivalence is content comparison — reliable precisely when the content came from `contract infer`, because inferred bodies are Postgres's own reprint — and closes the `contract infer` round-trip for both indexes and RLS policies so a database can be inferred, emitted, and verified with **zero operations required** ("sign the database directly"). We are pre-RC in the zero-semver range: this is the only window in which the wholesale index-identity switch can be applied at near-zero installed-base cost, and the transition machinery the project builds (content-pairing → `ALTER INDEX … RENAME`) converts every existing database automatically.

Requested by the ciphers team (EQL encrypted-search indexes); the identity mechanism is generic Postgres.

## Purpose

Make every index and RLS policy a **name-identified, round-trippable** contract element: authored in PSL and TypeScript (including SQL-expression bodies and partial-index predicates as opaque SQL strings), named managed-by-default with a content-hash wire name, adoptable from a live database via `contract infer` with zero drift, and migrated/verified through the one schema differ with no SQL-body comparison ever performed against a hand-authored string.

## The one identity rule

**Compare by content wherever content is faithfully comparable; where it isn't — SQL bodies, which Postgres reprints — the name carries a content hash and the name is the equivalence relation.**

Every index and policy node is identified in the diff tree by its **name**. Constraint nodes — primary key, foreign key, unique, check — are outside this rule: a constraint is its own discrete entity (never a marker on an index; [ADR 161's superseding note](../../docs/architecture%20docs/adrs/ADR%20161%20-%20Explicit%20foreign%20key%20constraint%20and%20index%20configuration.md), Data Contract design principle 4), and it is fully structured, so content comparison is already exact by this rule's own test — no wire name needed (see D5). Two naming modes exist, distinguished structurally (no stored strategy enum — the node selects its own equivalence from its own properties, per ADR 235's node-owned `isEqualTo`):

| Mode | Authored as | `name` in contract | `prefix` field | Diff pairing | Equality of a paired node |
| --- | --- | --- | --- | --- | --- |
| **Managed** (default) | `name:` prefix, or no name at all (default prefix derived) | `<prefix>_<8hex>` wire name, computed at lowering | present | by wire name | structured attributes compared; SQL bodies never compared (the hash in the name already covers them) |
| **Exact** | `map: "<verbatim>"` | the verbatim string, no hash | absent | by verbatim name | structured attributes AND SQL bodies compared byte-for-byte |

Exact mode exists for one flow: adoption. `contract infer` captures live objects with their live names and their reprinted bodies; byte-comparing reprint against reprint is exact. Hand-authoring a body under `map:` is permitted but warned (D9): the authored text is not a reprint, so verify will report perpetual false drift.

## Supported scenarios (normative)

This table is the behavioral contract. Every scenario gets an automated test (see plan).

| # | Scenario | Contract-side name | Behavior |
| --- | --- | --- | --- |
| A | **Sign a database directly**: `contract infer` → emit → `db verify` / plan against the same database | exact (`map:` with the live name, verbatim reprinted bodies) — except managed re-detection, see D8 | **Zero issues, zero operations.** Non-negotiable. |
| B | **Greenfield managed authoring**: write PSL/TS, migrate a fresh database | managed (`name:` prefix or default) | `CREATE INDEX <wire-name> …`; verify passes by name identity |
| C | **Exact → managed transition** (the "second step" after adoption): replace `map:` with `name:` (body text kept verbatim) | managed replaces exact | Planner pairs the missing managed node with the extra exact node **by content** and emits `ALTER INDEX/POLICY … RENAME TO` — never drop+create. Requires `widening`; under additive-only, degrades to create-only — and once the create has run, the pair can never rename (the rename precheck requires the target name absent), so the old object survives until a **destructive**-allowed plan drops it. Matches the existing policy-rename degradation. |
| D | **Prefix rename on managed**: change `name:` prefix, body untouched | managed, same hash | Existing ADR 234 rename detection: suffix match, prefix differ → `RENAME TO` |
| E | **Body/content edit on managed** | managed, new hash | Old wire name extra + new wire name missing → create + drop (drop gated `destructive`). An index rebuild is genuinely required; there is nothing to preserve. |
| F | **Out-of-band drift on an exact-named object** (live body altered under the same name) | exact | Content comparison fires `not-equal` → real drift, reported by verify; planner surfaces the existing `indexIncompatible` conflict (indexes) / drop+create (policies, existing semantics) |
| G | **Hand-authored body under `map:`** | exact | First `CREATE` works; verify then compares authored text vs reprint → false `not-equal` noise. **Degraded by design**; emit-time warning (D9) tells the user to use `name:`. |
| H | **Out-of-band structured drift on managed** (e.g. `ALTER INDEX … SET (fillfactor=70)`) | managed | Caught: managed `isEqualTo` compares structured attributes (D5). Surfaces as `not-equal` → verify drift / planner conflict. |
| I | **Pre-project database upgrade** (indexes created under the old plain-name scheme) | managed (re-emitted contract) | First `widening` plan: content pairing (as in C) pairs each plain-named live index with its hash-named replacement → renames only. No rebuilds, no hand-migration. |
| J | **Same-tuple twins** (a unique index plus a redundant plain index on identical columns, legal in Postgres) | any | Representable: identity is the name, so both index nodes coexist. The introspection dedup hack is deleted (D6). (A unique *constraint* beside a same-column index was never a collision — different node kinds.) |

## Design

### D1. Contract IR: `Index` gains bodies, uniqueness, and a required wire name

`packages/2-sql/1-core/contract/src/ir/sql-index.ts`:

```ts
export interface IndexInput {
  /** Full wire name (managed) or verbatim physical name (exact). Always present. */
  readonly name: string;
  /** The user-typed (or default-derived) prefix. Present iff managed. */
  readonly prefix?: string;
  /** Column-tuple elements. Exactly one of `columns` / `expression` is set. */
  readonly columns?: readonly string[];
  /** Opaque SQL: the ENTIRE element list between the parens of CREATE INDEX — one string, never parsed. Mixed column/expression indexes are written wholly inside it. */
  readonly expression?: string;
  /** Opaque SQL: partial-index predicate (WHERE body, without the keyword). */
  readonly where?: string;
  /** Rendered as CREATE UNIQUE INDEX. Default false. */
  readonly unique: boolean;
  readonly type?: string;
  readonly options?: Record<string, unknown>;
}
```

Invariants (enforced at construction with thrown errors, and at authoring with diagnostics per D3):

- `columns` xor `expression` — exactly one.
- `expression !== undefined ⇒` the index was authored with an explicit `name:` or `map:` (a default prefix cannot be derived from an expression).
- `name` is always the full physical name. `prefix !== undefined ⇔ name === formatWireName(prefix, <hash>)`.

`UniqueConstraint` (`unique-constraint.ts`, beside `sql-index.ts`) is untouched: a unique constraint is its own contract entity, never an index carrying a constraint marker — the same discrete-entities principle that split FKs from their backing indexes (ADR 161 superseding note; an element must be interpretable from its own node).

`PostgresRlsPolicy` ([postgres-rls-policy.ts](../../packages/3-targets/3-targets/postgres/src/core/postgres-rls-policy.ts)) and `PostgresPolicySchemaNode`: `prefix` becomes **optional** — absent means exact-named. No other field changes.

This is a breaking contract-shape change (canonicalization, serializer, `contract.d.ts`, storage hash all move). Pre-RC: acceptable; release notes carry the upgrade note (scenario I).

> **Satisfies:** expression/partial/unique indexes are representable; the naming mode is structurally encoded, no strategy enum.

### D2. SQL bodies are opaque strings, identical to RLS predicates

`expression` and `where` are never parsed, never validated as SQL, never bound to field names. Column references inside them are raw SQL — a field rename silently stales them, the same accepted trade-off RLS predicates made. Normalization for hashing is the existing minimal normalizer (trim + collapse internal whitespace), shared with RLS (D4). No SQL parser enters the codebase (ADR 234's rejected alternative stays rejected).

> **Satisfies:** ciphers' `eql_v3.eq_term(email)` and arbitrary vendor SQL work without a Postgres grammar; consistency with RLS.

### D3. Authoring surfaces

**PSL `@@index`** ([sql-attribute-specs.ts](../../packages/2-sql/2-authoring/contract-psl/src/sql-attribute-specs.ts) `indexModelSpec`) — full parameter matrix:

| Param | Type | Rules |
| --- | --- | --- |
| `fields` | positional field-ref list | now optional; xor `expression` |
| `expression` | string | xor `fields`; requires `name` or `map` |
| `where` | string | optional; combinable with either |
| `unique` | boolean | optional, default false |
| `name` | string | managed prefix; xor `map` |
| `map` | string | exact physical name; xor `name` |
| `type` | string | unchanged |
| `options` | record | unchanged (still requires `type`) |

Refine diagnostics (exact codes; message wording follows the existing `@@index` diagnostic style):

- `PSL_INDEX_FIELDS_XOR_EXPRESSION` — "`@@index` requires exactly one of a fields list or an `expression` argument"
- `PSL_INDEX_EXPRESSION_REQUIRES_NAME` — "`@@index` with an `expression` argument requires a `name` or `map` argument (a default name cannot be derived from an expression)"
- `PSL_INDEX_NAME_XOR_MAP` — "`@@index` takes at most one of `name` and `map`"

`@@unique` (`uniqueModelSpec`) is **unchanged**: it remains the *constraint* surface, and unique constraints stay outside the name-identity model (fully structured, content-compared — see D5). It does not take `expression`/`where`/`type`; an expression-unique is a unique **index** and is authored as `@@index(expression: …, unique: true)` (Postgres has no expression form of `ADD CONSTRAINT UNIQUE`).

**PSL policy blocks** (`policy_select` … `policy_all`): gain the `@@map("<exact name>")` block attribute, the same mechanism `native_enum` uses. With `@@map`, the block-head identifier remains the source-level logical identifier (duplicate-prefix checking unchanged) but the lowered entity is exact-named: `name = map value`, `prefix` absent, no hash computed. Without `@@map`, behavior is unchanged (head = prefix, wire name computed).

**TypeScript** ([contract-dsl.ts](../../packages/2-sql/2-authoring/contract-ts/src/contract-dsl.ts)):

```ts
type IndexConstraint = {
  kind: 'index';
  fields?: FieldNames;        // xor expression
  expression?: string;
  where?: string;
  unique?: boolean;
  name?: string;              // xor map
  map?: string;
  type?: string;
  options?: Record<string, unknown>;
};

// Overloads:
constraints.index(fields: ColumnRef | readonly ColumnRef[], opts?: { name?; map?; where?; unique?; type?; options? })
constraints.index(opts: { expression: string; name?: string; map?: string; where?; unique?; type?; options? }) // name or map required — enforced at lowering with the same diagnostics as PSL
```

`constraints.unique` is unchanged, symmetric with `@@unique`. TS policy helpers do not exist yet (postgres-rls closed without `rls-ts-authoring`); the `map?` descriptor parameter lands with whatever future work builds TS policy authoring (see § Dependencies).

Both surfaces lower through one shared path per entity so PSL/TS parity holds by construction; a parity test pins identical IR (wire names included) for identical inputs.

> **Satisfies:** both authoring surfaces, ciphers' index writable as `@@index(expression: "eql_v3.eq_term(email)", name: "users_email_eq")`.

### D4. Naming and hashing — shared helpers, exact tuples

The wire-name machinery hoists from `packages/3-targets/3-targets/postgres/src/core/rls/` to **`@prisma-next/sql-schema-ir/naming`** (beside `defaultIndexName`), because `SqlIndexIR` is family-shared and SQLite inherits the identity model:

- `formatWireName(prefix, hash): string` → `` `${prefix}_${hash}` `` (moved from `formatRlsPolicyWireName`; call sites updated, old module deleted — no re-export shims).
- `parseWireName(name): { prefix, hash } | undefined` → `/^(.+)_([0-9a-f]{8})$/` (moved from `parseRlsPolicyWireName`).
- `normalizeSqlBody(sql): string` → trim + collapse internal whitespace runs to one space (moved from `normalizePredicate`; RLS `canonicalize.ts` imports it).
- `computeIndexContentHash(parts): string` — first 8 lowercase hex of SHA-256 over `JSON.stringify` of the tuple below.

**Index hash tuple** (order fixed; this is a stability commitment with the same status as the RLS tuple — any change re-suffixes every wire name):

```
[
  normalizeSqlBody(expression ?? ''),
  normalizeSqlBody(where ?? ''),
  columns ?? [],                    // authored order — column order is semantic in an index
  unique,                           // boolean
  type ?? '',
  sortedOptions                     // Object.entries(options ?? {}) as [key, String(value)] pairs, sorted by key
]
```

The RLS tuple is unchanged. The user prefix, schema, and table are excluded from both tuples (ADR 234 rationale).

**Default prefixes** (managed mode with no `name:`): `@@index([a,b])` → `defaultIndexName(table, columns)`; FK-backing indexes → their current default name. So an unnamed index's wire name is `<today's-default-name>_<8hex>`. Unique constraints keep their existing default names unhashed (they are outside the wire-name model).

**Prefix length cap:** 54 characters (63-char `name` budget minus the 9-char suffix), enforced at lowering with a clear error — same rule as RLS.

> **Satisfies:** deterministic, target-independent naming; SQLite reuse; no drift between construction and parsing.

### D5. Schema IR: `SqlIndexIR` is name-identified; equivalence matrix

[sql-index-ir.ts](../../packages/2-sql/1-core/schema-ir/src/ir/sql-index-ir.ts) changes:

- `name` **required**; `prefix?: string` added; `expression?: string`, `where?: string` added; `columns` becomes optional (xor expression, same invariant as D1).
- `id` = `name` (the tuple-derived id and its doc-comment rationale are deleted).
- `isEqualTo(other)` — strategy selected by **`this`** (the differ always calls `expected.isEqualTo(actual)`):
  - **Both modes** compare: `unique` strict; `type` strict (after the existing btree→undefined normalization); `options` via the existing loose comparison; `columns` ordered-strict **when both sides carry them** (an expression index's actual side carries none — skipped).
  - **Exact mode** (`this.prefix === undefined`) additionally compares `expression ?? ''` and `where ?? ''` **verbatim, byte-for-byte, no normalization** (both sides are reprints in the supported flow; normalizing would only mask real drift).
  - **Managed mode** (`this.prefix !== undefined`) never compares `expression`/`where` — the hash in the name already covers them, and the actual side's reprint is not comparable.
- `dependsOn`: column-tuple indexes keep the existing per-column chains. Expression indexes stamp chains to **every column of their table** (a deterministic over-approximation — the covered columns cannot be known without parsing the expression; the index must drop before any column drop that would auto-drop it, otherwise the drop op's "index exists" precheck fails). Both derivations stamp by the same rule.

`PostgresPolicySchemaNode.isEqualTo`: managed unchanged (id equality ⇒ always true when paired). Exact-named (prefix absent): compare `operation`, `permissive`, sorted `roles`, `using ?? ''`, `withCheck ?? ''` — the SQL bodies verbatim, same rationale as above.

`SqlUniqueIR` (unique constraints, `pg_constraint`) is **untouched**. Postgres-rls slice 2.6 ([#947](https://github.com/prisma/prisma-next/pull/947)) settled that a unique constraint and an index are different schema elements — different catalog, different DDL, independent lifecycle — and stay two node kinds; its earlier attempt to merge them behind a constraint flag was rejected there, and the contract's discrete-entities principle (D1) forbids an index node that claims to also be a constraint. A unique constraint is fully structured (columns only), so its existing tuple identity + content comparison is already exact — by the one identity rule it needs no wire name. `PrimaryKey` nodes are likewise untouched.

> **Satisfies:** one identity rule for every index node; out-of-band structured drift (scenario H) stays detectable; no reprint is ever compared against hand-authored text under managed naming.

### D6. Introspection: full-fidelity index capture; the skip and dedup hacks are deleted

[control-adapter.ts](../../packages/3-targets/6-adapters/postgres/src/core/control-adapter.ts) index introspection:

- The query additionally selects `pg_get_expr(ix.indpred, ix.indrelid) AS where_predicate` and, per element position, `pg_get_indexdef(ix.indexrelid, k.ord::int, true) AS element_def` (Postgres returns the column name for simple elements and the expression text for expression elements).
- An index whose `indkey` contains any `0` attnum (expression element) is built as an expression node: `expression` = the per-position `element_def` values joined with `', '` (the whole element list, matching D1's whole-string semantics); `columns` undefined. Pure-column indexes keep `columns` from `attname` as today.
- `where` = `where_predicate` when non-null.
- **Deleted:** the `indexNamesWithExpressionKey` skip and the `bestByColumnTuple` same-tuple dedup — every non-constraint-backed index enters the tree, keyed by its (catalog-unique) name.
- `prefix` stamped from `parseWireName(indexname)?.prefix` (used only by the rename pass grouping, exactly as policy introspection does today; `undefined` when the name doesn't parse).

SQLite's control adapter is updated in the same slice to key its index nodes by name (SQLite index names are schema-unique) — no expression capture (see Non-goals).

> **Satisfies:** scenarios F/J; live functional indexes stop being invisible; sign-the-database has a faithful actual side.

### D7. Planner: op mapping, rendering, and the generalized rename post-pass

**`mapIndexNodeIssue`** ([issue-planner.ts](../../packages/3-targets/3-targets/postgres/src/core/migrations/issue-planner.ts)): `not-found` → `CreateIndexCall` (name always from the node — the `defaultIndexName` fallback at call sites is deleted); `not-expected` → `DropIndexCall`; `not-equal` → the existing `indexIncompatible` conflict, unchanged. `buildCreateTableCallsFromNode` passes the same fields through.

**`CreateIndexCall` / `createIndex` op** ([operations/indexes.ts](../../packages/3-targets/3-targets/postgres/src/core/migrations/operations/indexes.ts)): elements become `{ columns: readonly string[] } | { expression: string }`; extras gain `where?: string` and `unique?: boolean`. Render:

```
CREATE [UNIQUE ]INDEX "<name>" ON <schema>.<table>[ USING <type>] (<quoted columns | expression verbatim>)[ WITH (<options>)][ WHERE (<where verbatim>)]
```

`expression` and `where` are inserted verbatim — never quoted, never escaped (they are SQL, exactly like RLS predicate rendering).

**New `RenameIndexCall`** → `ALTER INDEX <schema>."<from>" RENAME TO "<to>"`; `operationClass: 'widening'`; precheck: from-name exists AND to-name absent; postcheck: to-name exists. Classified into the existing `index` bucket.

**Rename post-pass** (extends the policy-only pass in [planner.ts:355](../../packages/3-targets/3-targets/postgres/src/core/migrations/planner.ts); runs only when `widening` is allowed; per `(schema, table)`):

1. **Phase 1 — hash pairing** (managed↔managed, scenario D): identical algorithm to the existing policy pass — extras whose names parse, grouped by `(schema, table, hash)`, missing iterated in sorted-name order, first candidate (sorted-name order) consumed → `RenameIndexCall`.
2. **Phase 2 — content pairing** (exact→managed transition, scenarios C and I): over the *remaining* missing nodes whose `prefix` is defined (managed) and *remaining* extras (any name shape). A pair matches iff **content-equal**: `columns` ordered-strict (both-defined or both-undefined), `unique` strict, `type` strict, `options` loose, `expression ?? ''` and `where ?? ''` verbatim-equal. Determinism: missing sorted by name, candidates sorted by name, first match consumed. Match → `RenameIndexCall`.

Leftovers proceed as create (additive) / drop (destructive) exactly as today. The **same phase 2** is added to the RLS policy pass with policy content equality (D5's exact-policy tuple). Phase-2 consequence to document verbatim in user docs: the transition pairs only when the body text is byte-identical — change the name mode and the body in one step and you get drop+create instead of a rename (indexes: a rebuild).

> **Satisfies:** scenarios C, D, I; upgrade is automatic; no new not-equal semantics invented.

### D8. `contract infer` round-trip (scenario A)

Postgres inference ([infer-psl-contract.ts](../../packages/3-targets/3-targets/postgres/src/core/psl-infer/infer-psl-contract.ts)) is extended:

- **Indexes.** For each introspected index node: recompute the wire hash from the introspected content (D4 tuple). If the live name parses as `<prefix>_<hash>` **and** the recomputed hash equals the parsed hash → emit managed authoring (`name: <prefix>`); this holds for every fields-only index this toolchain created, so our own databases re-infer to managed contracts byte-identically. Otherwise → emit `map: "<live name>"` with the content verbatim (`expression`/`where` as reprinted). Expression indexes always take the `map:` branch (the reprint never hashes to the authored suffix). `unique: true` for non-constraint-backed unique indexes; constraint-backed uniques keep flowing to `@@unique` as today (tuple-identified; the constraint name does not participate in equivalence).
- **Policies** (closing the "later slice" note at [infer-psl-contract.ts:278](../../packages/3-targets/3-targets/postgres/src/core/psl-infer/infer-psl-contract.ts)): each `pg_policies` row emits a `policy_<cmd>` block: head identifier = `parseWireName(policyname)?.prefix ?? policyname`, sanitized to a PSL identifier (collisions within the namespace disambiguated with a numeric suffix — the head is source-only); `@@map("<policyname>")` **always** (a policy body reprint never re-hashes to the live suffix, so managed re-detection is impossible — policies always adopt as exact); `target`, `roles`, `using`/`withCheck` verbatim from `qual`/`with_check`, `permissive` from the row.
- **RLS enablement.** Tables with `pg_class.relrowsecurity = true` emit the existing `@@rls` model attribute so `rlsEnabled` round-trips.

Acceptance for this decision is scenario A literally: infer → emit → `db verify` reports zero issues and `migration plan` (offline, contract-vs-introspection) emits zero operations, on a database containing expression indexes, partial indexes, unique expression indexes, and RLS policies created by another tool.

> **Satisfies:** the round-trip bug (policies) is fixed rather than inherited by indexes; adoption is a first-class flow.

### D9. Exact-name authoring warning

Emitted at lowering (both surfaces) when `map:` is combined with a SQL body — i.e. an index with `expression` or `where`, or any policy — as a **warning diagnostic** (non-blocking), code `EXACT_NAME_BODY_COMPARISON`:

> `<index|policy> "<name>" uses map: with a SQL body. Drift detection compares the authored SQL text byte-for-byte against Postgres's reprinted form, which is only reliable when the text was captured by contract infer. For hand-authored definitions, use name: and let Prisma Next manage the physical name; to migrate an adopted object to managed naming, replace map: with name: (keeping the body text unchanged) and apply the resulting rename migration.`

`map:` on a fields-only index or `@@unique` emits no warning (content is fully structured; comparison is exact).

> **Satisfies:** scenario G is a known, explained degradation, and the C-transition guidance is delivered at the moment it's relevant.

### D10. Layering

Wire-name helpers and `SqlIndexIR` semantics live in `2-sql/1-core` (family-shared). Expression **authoring** parameters live in the SQL-family authoring packages (`contract-psl`, `contract-ts`) since `@@index` is family-level. Everything policy-shaped stays Postgres-target-only, as today. `pnpm lint:deps` and `lint:framework-vocabulary` must stay green; no framework (`1-framework`) package learns any of these concepts.

## Dependencies and coordination

- **Slice-0 dependency: resolved.** Postgres-rls slice 2.6 merged as [#947](https://github.com/prisma/prisma-next/pull/947) (2026-07-10), but with a **different node shape than this spec originally assumed**: it kept `SqlUniqueIR` and `SqlIndexIR` as two structural nodes and rejected the merged-node-with-flag design (its Alternatives section records why — under tuple identity the merge forced dedup/fail-loud hacks back in; independently, an index claiming "I'm also a constraint" breaks the contract's discrete-entities principle). This spec is amended to that substrate: name identity covers index nodes and policies; unique constraints stay tuple-identified (D5). The operator confirmed this direction on 2026-07-23.
- **TS policy authoring does not exist.** Postgres-rls closed out ([#979](https://github.com/prisma/prisma-next/pull/979)) without landing its `rls-ts-authoring` slice; there are no `policySelect`-style helpers in `contract-ts`. The TS half of policy exact-naming (`map?` on the descriptor) is out of this project's scope and lands with whatever future work builds TS policy authoring. PSL `@@map` on policy blocks (slice 3) is unaffected.

## Non-goals

- **Views** — no view entity kind exists (no authoring, IR, ops, or introspection); building views is its own project. The ADR names the identity model as binding for views when they arrive.
- **Raw/user-authored CHECK constraints** — today's check node is a structured enum-style `IN (...)` value-set ([sql-check-constraint-ir.ts](../../packages/2-sql/1-core/schema-ir/src/ir/sql-check-constraint-ir.ts)), machine-generated only; there is no raw-CHECK authoring surface to apply the model to. Same ADR forward-binding.
- **SQLite expression-index authoring** — SQLite inherits the name-identity change (shared `SqlIndexIR`) and its adapter is updated for name-keying, but the expression authoring surface is enabled for Postgres only in this project.
- **MongoDB** — separate family, structural index matching per ADR 189, untouched.
- **Per-element mixed field-ref/expression lists** — the expression is one opaque string covering the whole element list; no fieldRef-or-string union enters the attribute grammar.
- **Hash-invariant normalizer evolution** — ADR 234's stance stands; no version marker.
- **Binding expression column references to fields** — expressions are opaque; rename-staleness is accepted (as for RLS predicates).

## Project DoD

1. **Ciphers scenario e2e**: `@@index(expression: "eql_v3.eq_term(email)", name: "users_email_eq", type: "btree")` (and the TS equivalent) emits, migrates a fresh database, `db verify` passes; dropping the index out-of-band fails verify; the rendered DDL is byte-asserted.
2. **Sign-the-database e2e** (scenario A): a database prepared with raw SQL containing an expression index, a partial index, a unique expression index, and two RLS policies → `contract infer` → emit → verify: zero issues; plan: zero ops.
3. **Transition e2e** (scenario C): from the signed contract, replace `map:` with `name:` on one index and one policy → the widening plan contains exactly the two RENAMEs; apply; verify clean.
4. **Upgrade e2e** (scenario I): a database migrated with the pre-project toolchain (plain index names) + its re-emitted contract → the first widening plan is renames-only.
5. Every scenario row A–J has at least one automated test asserting the stated behavior.
6. Full CI gate set green (build, typecheck, whole Lint job incl. `lint:deps` + `lint:framework-vocabulary`, `fixtures:check`, `test:packages`, `test:integration`, `test:e2e`); example contracts and fixtures re-emitted.
7. ADR merged into `docs/architecture docs/adrs/` (from [specs/adr-name-identified-indexes.md](specs/adr-name-identified-indexes.md)); release notes carry the breaking-change + upgrade entry; project folder deleted at close-out per [projects/README.md](../README.md).

## References

- [ADR 234 — Content-addressed wire names](../../docs/architecture%20docs/adrs/ADR%20234%20-%20Content-addressed%20wire%20names%20for%20Postgres-normalized%20objects.md) (extended by this project)
- [ADR 235 — The schema differ walks two derived schema IRs](../../docs/architecture%20docs/adrs/ADR%20235%20-%20The%20schema%20differ%20walks%20two%20derived%20schema%20IRs.md) (node-owned equivalence)
- [ADR 210 — Index-type registry](../../docs/architecture%20docs/adrs/ADR%20210%20-%20Index-type%20registry.md) (`type`/`options` validation, unchanged)
- [ADR 009 — Deterministic Naming Scheme](../../docs/architecture%20docs/adrs/ADR%20009%20-%20Deterministic%20Naming%20Scheme.md) (default names become managed prefixes)
- [#947](https://github.com/prisma/prisma-next/pull/947) — unique constraints and indexes are two structural nodes; the reconciliation pass is deleted (substrate this project builds on; postgres-rls itself closed out in [#979](https://github.com/prisma/prisma-next/pull/979))
- [ADR 161 — Explicit foreign key constraint and index configuration](../../docs/architecture%20docs/adrs/ADR%20161%20-%20Explicit%20foreign%20key%20constraint%20and%20index%20configuration.md) (superseding note: constraints and indexes are discrete entities)
- ADR draft: [specs/adr-name-identified-indexes.md](specs/adr-name-identified-indexes.md)
