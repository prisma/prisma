# Spec — Slice 4: `infer-round-trip`

**Parent:** [project spec](../spec.md) § D8 · [plan](../plan.md) slice 4 (including its two carry-over bullets) · builds on slices 1–3. This slice completes scenario A and the project DoD.

## At a glance

Sign a database this toolchain has never seen:

```
contract infer → emit → db verify: zero issues → db update --dry-run: zero operations
```

— on a database containing an expression index, a partial index, a unique expression index, and RLS policies created by another tool. `contract infer` emits every index at full fidelity (managed re-detection where the wire name recomputes, `map:` otherwise) and every policy as a `policy_*` block with `@@map` and verbatim reprinted bodies, plus `@@rls`. The emitted contract *is* the database's signature.

## Chosen design

### 1. Index emission — full matrix with managed re-detection

`infer-psl-contract.ts`: the single slice-1 skip guard (line ~745, `columns === undefined || where !== undefined`) is deleted; the `!index.unique` gate (line ~746) is deleted (unique non-constraint indexes stop being silently dropped). Every non-constraint index emits:

- **Managed re-detection** (D8): `parseWireName(index.name)` and recompute `computeIndexContentHash` from the introspected node's own fields (columns/expression/where/unique/type/options — the tuple inputs are exactly recoverable; options `String()`-coercion agrees on both sides). Parsed hash === recomputed hash → emit `name: "<prefix>"` (managed). Otherwise → `map: "<live name>"` (exact) with the content verbatim.
- Expression indexes always take the `map:` branch (the reprint never re-hashes to the authored suffix — confirmed, no counterexample path). **Known benign edge**: an index authored `type: "btree"` hashed `'btree'` into its suffix but introspects type-normalized, so recompute mismatches and it re-infers as `map:` — still a clean round-trip, just exact rather than managed; documented in a code comment, not special-cased.
- Emission surface: `buildModelConstraintAttribute` grows a branch (or sibling builder) — expression indexes have no positional field list and emit `expression:` as a named string arg; `where:`/`unique: true`/`type:`/`options:` named args as introspected; the managed branch switches today's hardwired `map:` to `name:`. All strings through `escapePslString`.
- Constraint-backed uniques keep flowing to `@@unique` exactly as today (tuple-identified).

### 2. The duplicate-guard carry-over

`validateStorageSemantics` (`validators.ts:532–556`): the duplicate-index rejection keys by content signature, which would reject a legally-twinned database (two content-identical indexes under different names — the Supabase reference carries one). For **exact-mode** entries (no `prefix`) the guard keys by `name`; managed entries keep the content key (two managed twins would collide on wire name anyway — same hash — so the content key is already equivalent there; state that in a comment). A signed twin-carrying database validates.

### 3. Policy block emission (D8 policy half)

Per introspected policy node, in its namespace block:

- **Head identifier**: `parseWireName(policyname)?.prefix ?? policyname`, sanitized to the PSL identifier grammar (tokenizer rules: leading `\p{L}`/`_`, then letters/digits/`_`/`-`; replace invalid runs with `_`, prepend `_` if the first char is invalid); within-namespace collisions disambiguated with a numeric suffix (`_2`, `_3`, … — deterministic by sorted physical name). The head is source-only.
- **`@@map("<policyname>")` always** — a body reprint never re-hashes to the live suffix, so managed re-detection is impossible for policies; every adopted policy is exact. (Emitting these blocks means re-emitting an adopted contract fires the D9 warning batch — by design, the wording covers the infer-captured case.)
- Properties: `target` (the model), `roles` (introspected list as-is), `using`/`withCheck` verbatim from `qual`/`with_check` reprints, `permissive` per § 4.
- **Unauthorable policies skip with a PSL comment note** (`// prisma-next: skipped policy "<name>": <reason>`) rather than failing the whole infer: a role name outside the PSL identifier grammar (role refs have no `@@map` escape). The scenario-A fixture contains none; the skip path is unit-tested. A skipped policy is a live extra — strict verify will name it, which is the honest outcome.

### 4. `permissive` becomes authorable (falsified-assumption resolution)

D8 commits to "`permissive` from the row", but RESTRICTIVE has no authoring surface — the five block descriptors expose no parameter and both lowerings hardcode `true`. Completing D8 needs the minimal enabler: the five `policy_*` blocks gain an optional `permissive` boolean property (default `true`), threaded through `lowerRlsPolicyFromBlock`/`buildRlsPolicyEntity` (three hardcoded sites) into the existing hash-tuple slot and entity field. Managed `permissive: true` hashes are byte-unchanged (the tuple already contained `permissive`); a RESTRICTIVE live policy now infers and round-trips like any other. The TS entity-handle path stays as-is (managed, defaulted `true`) unless trivially symmetric. If threading this touches more than the descriptors + the two lowering functions + tests, stop and surface.

### 5. `@@rls` emission

`buildModel` pushes the existing `@@rls` model attribute (`{ target:'model', name:'rls', args:[] }`) when the table node carries `rlsEnabled` — the shape the Supabase harness currently bolts on out-of-band. The harness's `applyRlsEnablement` is then **deleted** and the Supabase contract regenerated through `contract:generate`: `@@rls` now native, partial indexes re-adopt (the slice-1 transitional omission ends), and policy blocks appear if the reference schema carries policies. `CONTRACT-FIDELITY.md` updated to match (the partial-index omission passage comes out).

### 6. Acceptance — the project DoD lands here

- **DoD-2, sign-the-database e2e**: raw-SQL database with an expression index, a partial index, a unique expression index, and two RLS policies (permissive + one RESTRICTIVE to prove § 4) created "by another tool" → infer → emit → verify **zero issues** → `db update --dry-run` **zero operations**. Extends `index-name-convergence.e2e.test.ts`'s scenario-A journey or a new sibling.
- **DoD-3, transition e2e**: from the signed contract, replace `map:` with `name:` on one index AND one policy (bodies verbatim) → the widening plan contains **exactly the two RENAMEs** → apply → verify clean.
- **DoD-4, upgrade e2e**: the scenario-I journey already exists (slice 1); confirm it still holds on the full stack and reference it — no duplicate.
- **DoD-5, scenario sweep**: a checklist walk in the report mapping every scenario row A–J to its named test across slices 1–4 (A completes here; B/D/E/G/H slice 2; C/F slice 3 + this slice's transition; I/J slice 1).
- Re-infer stability (`contract-infer-workflow` journey) and the fidelity instrument (`infer-roundtrip-fidelity`) extended with the new emissions.

### 7. Release notes and close-out prep

The 0.16-to-0.17 upgrade entries gain this slice's additions (infer emissions, `permissive`, the guard change). The committed `docs/releases/v0.17.0.md` is **deliberately not authored here**: repo convention authors it at release-cut time via the `draft-release-notes` skill (which enumerates all merged PRs; the gate only fires on version bumps) — the plan's "release-notes draft" line is satisfied by the upgrade entries being complete and is noted as such in plan.md at close-out. Close-out itself (ADR promotion, reference stripping, `projects/functional-indexes/` deletion) is the project's final PR, after this slice merges — not this slice.

## Coherence rationale

One capability — "the emitted contract is the database's signature" — landed as one PR: emission, re-detection, the two carry-overs that block signing real databases, and the DoD journeys that prove it. The `permissive` addition is the one authoring change, justified as D8's minimal enabler.

## Scope

**Deliberately out:** TS policy authoring; RESTRICTIVE beyond the block parameter; role declarations/`@@map` on role refs (undeclared roles load by design; ungrammatical role names skip-with-note); the close-out PR; `docs/releases/v0.17.0.md`.

## Pre-investigated edge cases

| Case | Obligation |
| --- | --- |
| `type: "btree"` re-detection miss | Benign exact fallback; comment + test, no special case. |
| RESTRICTIVE policies | Authorable via § 4; the e2e proves one. |
| Ungrammatical role names | Policy skips with note; unit test; strict verify honestly names the leftover. |
| Twin indexes | Guard keyed by name for exact entries (§ 2); the Supabase regen is the live proof. |
| Head collisions after sanitization | Deterministic numeric suffix; unit test with two colliding physical names. |
| Supabase harness | `applyRlsEnablement` deleted; regen through the checked-in generator only; expect partial indexes + `@@rls` (+ policies if seeded) — any other movement must be explained. |

## Slice-specific done conditions

1. DoD-2 and DoD-3 e2e green, byte-asserted where stated; DoD-4 referenced; DoD-5 walk complete in the report.
2. Supabase contract regenerated with the transitional omission ended and the harness helper deleted.
3. Full standing gate green.

## Open questions

None.

## References

Grounding: `infer-psl-contract.ts:306,318,336–429,700–755,1013–1068`, `naming.ts:34,57,85–97`, `index-naming.ts:116–175`, `sql-index-ir.ts:21,95–130,178–195`, `validators.ts:459–572`, `control-adapter.ts:1247–1330`, `authoring.ts:146–252,462–545`, `tokenizer.ts:249–255`, `generate-contract.ts:181–235,451–455`, `index-name-convergence.e2e.test.ts`, `infer-roundtrip-fidelity.e2e.test.ts`, `contract-infer-workflow.e2e.test.ts`, `docs/releases/README.md`, `scripts/check-release-notes.mjs`.
