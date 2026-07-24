# Spec — Slice 2: `expression-index-authoring`

**Parent:** [project spec](../spec.md) §§ D3, D9 · [plan](../plan.md) slice 2 · builds on slice 1 ([indexes-are-name-identified.spec.md](indexes-are-name-identified.spec.md)).

## At a glance

The ciphers team can author their index:

```prisma
model User {
  id    Int    @id
  email String
  @@index(expression: "eql_v3.eq_term(email)", name: "users_email_eq", type: "btree")
}
```

and the TS equivalent — `constraints.index({ expression: 'eql_v3.eq_term(email)', name: 'users_email_eq', type: 'btree' })`. Both surfaces gain the full D3 parameter matrix (`expression`, `where`, `unique`, `name`/`map`), invalid combinations get span-anchored PSL diagnostics with dedicated codes, and hand-authoring a SQL body under `map:` draws the D9 warning. The substrate (IR, hashing, planner, introspection) shipped in slice 1 — this slice is authoring UX only.

## Chosen design

### 1. PSL `@@index` matrix (D3)

`indexModelSpec` (`sql-attribute-specs.ts:198`) becomes:

- `fields` positional → `optional(list(fieldRef('self'), …))` (the engine's `isOptionalArgType` supports optional positionals).
- Named: `expression: optional(str())`, `where: optional(str())`, `unique: optional(bool())`, `name: optional(str())`, `map` / `type` / `options` unchanged. The existing options-requires-type refine stays.
- New refines, D3's three diagnostics with their exact codes and messages (spec § D3): `PSL_INDEX_FIELDS_XOR_EXPRESSION`, `PSL_INDEX_EXPRESSION_REQUIRES_NAME`, `PSL_INDEX_NAME_XOR_MAP`.

`@@unique` (`uniqueModelSpec`) stays byte-unchanged (constraint surface; project spec D3/D5).

The interpreter's `@@index` branch (`interpreter.ts:971–1005`) carries the new fields onto `IndexNode` (`name`, `expression`, `where`, `unique` join the existing `map`/`type`/`options`).

**Diagnostic-code mechanism** (grounding gap): `PslDiagnosticCode` is a closed union in `1-framework/framework-components` and `leafDiagnostic` hardcodes `PSL_INVALID_ATTRIBUTE_SYNTAX`. Family vocabulary must not enter framework (D10, `no-family-vocabulary-in-framework`), so the three index codes do NOT go into the framework union. Instead: widen the extensibility seam, not the vocabulary — `PslDiagnostic.code` becomes `PslDiagnosticCode | ContributedPslDiagnosticCode` where `ContributedPslDiagnosticCode` is a branded/pattern string type (framework stays family-neutral; the framework change is one type, no strings), and `leafDiagnostic` gains an optional `code` parameter defaulting to today's value. The three `PSL_INDEX_*` codes are defined beside `indexModelSpec` in `contract-psl`. If this trips `lint:framework-vocabulary` or breaks a closed-union consumer in a way that spreads beyond a couple of files — stop and surface; do not improvise a third mechanism.

### 2. TS `constraints.index` matrix (D3)

`contract-dsl.ts`: `IndexConstraint` gains `map?`, `expression?`, `where?`, `unique?`; `index(...)` gains the second overload `(opts: { expression: string; name?; map?; where?; unique?; type?; options? })` and the fields-overload's options gain `map?`/`where?`/`unique?`. The overload shapes make `fields`-xor-`expression` structurally awkward to violate; everything the type system can't express is enforced at lowering (below). `constraints.unique` unchanged.

`contract-lowering.ts:813` threads the new fields from `IndexConstraint` → `IndexNode`.

### 3. One shared enforcement + lowering path

`lowerAuthoredIndex` (`index-naming.ts`) — already the single path for both surfaces via `buildSqlContractFromDefinition` (`build-contract.ts:923`) — gains `expression`/`where`/`unique` on `AuthoredIndexInput`, threads them into the carried node and the hash tuple (the tuple already has their slots; fields-only hashes are unchanged), and upgrades its guards to user-facing errors (`contractError` style, `CONTRACT.ARGUMENT_INVALID` family): columns-xor-expression, expression-requires-name-or-map, map-xor-name (today's `InternalError` — reachable from TS authoring once `map` exists, so no longer internal). PSL reaches these same states only if a refine missed them — the shared lowering is the enforcement backstop; PSL diagnostics are the span-anchored UX layer in front of it. A PSL/TS parity test pins identical IR (wire names included) for identical matrix inputs.

FK materialization (`foreign-key-materialization.ts:97`) is untouched (columns-only, `unique: false`).

### 4. D9 warning — `EXACT_NAME_BODY_COMPARISON`

Fires when `map:` combines with a SQL body (`expression` or `where` present); fields-only `map:` stays silent. Exact message wording from project spec § D9.

**Mechanism** (grounding gap — PSL has no non-blocking diagnostic; any diagnostic fails the load): the warning is emitted from the shared lowering via the existing `contract-warnings.ts` pattern (`process.emitWarning`, batched, code `PN_EXACT_NAME_BODY_COMPARISON`), which covers BOTH surfaces because PSL lowers through the same builder. No severity field is added to `PslDiagnostic`; no framework change. (Policies gain the same warning in slice 3.)

### 5. Scenario-row tests and the ciphers e2e (DoD-1)

- **DoD-1 e2e**: rewrite `expression-index-migration.e2e.test.ts` to author through the real surfaces — a `.prisma` fixture with the ciphers index (plus a partial and a unique-expression index) registered in `pslContractFixtures`, and a `.ts` twin in `contractFixtures`; emit → plan (DDL byte-asserted, `eql_v3.eq_term` rendered verbatim) → apply → verify → out-of-band drop fails verify. The slice-1 factory-assembled fixture is deleted (superseded).
- **Scenario rows** (project spec table): **B** greenfield managed authoring via the matrix (covered by the e2e); **D** prefix rename e2e — change `name:` on the expression index, plan is exactly one `ALTER INDEX … RENAME`; **E** body edit — change the expression, plan is create + drop (drop under destructive); **G** hand-authored body under `map:` — warning emitted (assert via a `process.emitWarning` listener) and the false-drift consequence pinned as a documented-degradation test; **H** out-of-band `ALTER INDEX … SET (fillfactor=70)` on a managed index → verify reports `not-equal` (integration; the unit matrix landed in slice 1).

## Coherence rationale

One authoring feature completed across both surfaces with its diagnostics and warning in one PR — the parameter matrix, the enforcement, and the proof journeys are a single reviewable UX contract. The substrate is untouched; the only sub-authoring change is threading three fields through the already-shared lowering.

## Scope

**In:** the above; `docs/` authoring reference pages for `@@index`/`constraints.index` if they enumerate parameters (grep; update in place).

**Deliberately out:** policy `@@map`/prefix/pairing (slice 3); infer changes (slice 4); `@@unique`/`constraints.unique`; SQLite expression authoring (family-shared machinery means the PSL params technically parse for SQLite targets — the sqlite target must REJECT expression/where at lowering with a clear not-supported error, matching the project non-goal); any framework severity concept.

## Pre-investigated edge cases

| Case | Obligation |
| --- | --- |
| PSL diagnostic codes are framework-closed | Resolved by design § 1 (contributed-code seam); stop-condition if it spreads. |
| PSL has no non-blocking diagnostic | Resolved by design § 4 (shared-lowering `process.emitWarning`); do not add severity to `PslDiagnostic`. |
| `lowerAuthoredIndex` map+name guard is `InternalError` | Becomes user-facing once TS gains `map` — upgrade to `contractError`; PSL still pre-empts with `PSL_INDEX_NAME_XOR_MAP`. |
| SQLite | Family-shared authoring params must not silently produce SQLite expression indexes; explicit lowering rejection + test. |
| Existing `@@index(map:)` fixtures (Supabase etc.) | Fields-only `map:` must stay warning-free and byte-stable — `fixtures:check` clean with zero fixture movement expected this slice. |

## Slice-specific done conditions

1. DoD-1 ciphers e2e green in both PSL and TS variants with byte-asserted DDL.
2. Scenario rows B, D, E, G, H each have a named test asserting the stated behavior.
3. The three PSL diagnostics are span-anchored (point at the `@@index` attribute) with their exact codes, each pinned by an interpreter diagnostics test; TS lowering errors pinned equivalently.
4. Full gate incl. `lint:throws`, `lint:framework-vocabulary`, `check:upgrade-coverage` (new authoring surface ⇒ upgrade-skill entries), `test:examples`.

## Open questions

None.

## References

Grounding: `sql-attribute-specs.ts:193–211`, `psl-parser` `diagnostic.ts:6–15` + `interpret.ts:103,171`, `psl-extension-block.ts:26–118`, `psl-ast.ts:27–32`, `interpreter.ts:971–1005,2467`, `contract-dsl.ts:773–999`, `contract-lowering.ts:813`, `build-contract.ts:923–931`, `index-naming.ts:16–56`, `contract-warnings.ts:105–125`, `ts-psl-parity.test.ts:482–544`, `journey-test-helpers.ts:192–248`, `expression-index-migration.e2e.test.ts`.
