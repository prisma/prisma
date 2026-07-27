# Spec — Slice 3: `rls-exact-names`

**Parent:** [project spec](../spec.md) §§ D1 (policy half), D3 (policy half), D5 (policy half), D7 (policy half), D9 · [plan](../plan.md) slice 3 · builds on slices 1–2.

## At a glance

A policy adopted from a live database becomes authorable without renaming it:

```prisma
policy_select existing_tenant_read {
  target  User
  roles   [app_user]
  using   "tenant_id = current_setting('app.tenant')::uuid"
  @@map("Tenant members can read")
}
```

With `@@map`, the lowered policy is **exact-named**: `name` is the verbatim physical name, no `prefix`, no hash — and equivalence becomes content comparison (structured attributes strict, SQL bodies byte-for-byte), reliable precisely when the body text is a Postgres reprint. Replacing `@@map` with the plain head prefix later converges via a single `ALTER POLICY … RENAME` (content pairing), completing scenario C for policies. This is the policy half of the identity model indexes adopted in slices 1–2; slice 4's infer emits these blocks.

## Chosen design

### 1. `prefix` becomes optional (D1 policy half)

`PostgresRlsPolicyInput`/`PostgresRlsPolicy` (`postgres-rls-policy.ts`), `PostgresPolicySchemaNodeInput`/`PostgresPolicySchemaNode` (`postgres-policy-schema-node.ts`), and the arktype `PostgresRlsPolicySchema` (`postgres-validators.ts:10`) all make `prefix` optional — absent ⇔ exact-named. Constructors assign conditionally (the repo's `ifDefined` convention); `policyNodeToContractPolicy` (`planner.ts:721`) tolerates absence. Constructor invariant, mirroring the index entity: `prefix !== undefined ⇒ name === formatWireName(prefix, <8hex>)` shape with matching prefix (`parseWireName` check, no hash recomputation). The TS entity-handle path (`postgresLowerEntityHandles`) stays managed-only — no new TS parameter (project § Dependencies: TS policy authoring doesn't exist).

Managed policies keep every byte of today's behavior; contracts not using exact policies must not move (`fixtures:check` — flag ANY movement and explain it before proceeding).

### 2. PSL `@@map` on the five policy blocks (D3 policy half)

`lowerRlsPolicyFromBlock` (`authoring.ts:179`) reads `block.blockAttributes.find(a => a.name === 'map')` — the exact `native_enum` mechanism (`authoring.ts:241–263`, `unwrapQuotedString`); no grammar or descriptor change (the parser already surfaces `blockAttributes` on every extension block). With `@@map`: the block-head identifier stays the source-level logical identifier (head-keyed duplicate checking byte-unchanged, `PSL_DUPLICATE_EXTENSION_ENTITY` untouched) but the lowered entity is exact — `name` = map value verbatim, `prefix` absent, no hash computed, no prefix-length cap applied (the 54-char cap is a wire-prefix rule; exact names are verbatim physical names, same stance as index `map:`). Invalid `@@map` argument → new diagnostic `PSL_POLICY_INVALID_MAP` via slice 2's contributed-code seam, message mirroring `PSL_NATIVE_ENUM_INVALID_MAP`. Without `@@map`, behavior byte-unchanged (head = prefix, wire name computed, cap enforced).

### 3. Mode-selected policy equivalence (D5 policy half)

`PostgresPolicySchemaNode.isEqualTo` selects on `this.prefix`:

- **Managed** (`prefix` present): unchanged — id equality (paired ⇒ equal).
- **Exact** (`prefix` absent): compare `operation`, `permissive`, sorted `roles`, and `using ?? ''` / `withCheck ?? ''` **verbatim, byte-for-byte, no normalization** (the node already carries every field; only the branch is new).

The planner comment "`not-equal` is unreachable" (`planner.ts:526`) becomes false: a `not-equal` policy issue maps to **drop + create** (project scenario F, "existing semantics") — drop gated `destructive`; without `destructive` the issue surfaces as a planner conflict (the policy analog of `indexIncompatible` — reuse the existing policy conflict vocabulary if one exists, else the generic node-conflict path; do not invent a new conflict kind without checking).

### 4. Introspection prefix stamping matches the index convention (D6 policy half)

`control-adapter.ts:1270` currently stamps `prefix = parseWireName(policyname)?.prefix ?? policyname` — the fallback conflates "managed" with "adopt as exact". It becomes `parseWireName(policyname)?.prefix` (undefined when unparseable), byte-matching the index convention from slice 1. The `?? policyname` derivation reappears in slice 4 as the *source head identifier* rule in infer — a comment marks that. Consequence to verify in tests: a live policy with an unparseable name introspects as an exact-shaped actual node; verify behavior for stray/tolerated extras is unchanged (equality is driven by the expected side).

### 5. Policy content pairing — phase 2 (D7 policy half)

In `planPostgresSchemaDiff`, after the existing phase-1 hash pairing (`planner.ts:560–596`): phase 2 over the *remaining* missing nodes with `prefix` defined × *remaining* extras of any name shape, pairing iff content-equal — `operation` strict, `permissive` strict, `roles` sorted-strict, `using ?? ''`/`withCheck ?? ''` **verbatim** (a `policyContentEqual` sibling of `indexContentEqual`, `planner.ts:742` — NOT the normalized hash tuple). Deterministic: missing sorted by name, candidates sorted by name, first match consumed → `RenamePostgresRlsPolicyCall`. Widening-only; leftovers create/drop exactly as today; index pass untouched.

### 6. D9 for policies — the warning sink wiring

`ExactNameBodyWarning.subject` already admits `'policy'`, but the postgres pack's policy lowering can't reach `build-contract.ts`'s collector. Wiring (grounded choice): `AuthoringEntityContext` (`framework-authoring.ts:187`) gains an optional, **generic** warning sink beside its existing `diagnostics` sink (family-neutral framework field — a callback accepting `{ code, message }`-shaped entries; no policy/index vocabulary). `buildSqlContractFromDefinition` passes a sink that feeds the same `exactNameBodyWarnings` batch it already flushes once per build; `lowerRlsPolicyFromBlock` pushes a D9 hit (subject `'policy'`, exact name) whenever `@@map` is present — every policy has a body, so every `@@map` policy warns, message per project § D9. If the framework field can't stay generic or spreads beyond `framework-authoring.ts`, stop and surface.

### 7. Scenario tests (C and F, policy edition)

- **C — exact → managed transition e2e** (cli-journey): PSL fixture with an `@@map` policy adopted against a live database created with that exact policy (raw SQL); verify clean (zero issues); swap to the managed head (drop `@@map`, keep body text verbatim) → the widening plan is **exactly one** `ALTER POLICY … RENAME` (byte-asserted) → apply → verify clean. Plus the planner-unit phase-2 cases ported from the index suite (deterministic multi-candidate, byte-different body does not pair, exact-named missing never pairs, additive-only degradation).
- **F — out-of-band drift on an exact-named policy** (adapter integration): live `ALTER POLICY` changing the body under the same name → verify reports `not-equal`; plan under destructive = drop + create; without destructive = conflict. Also the managed-mode contrast (same drift on a managed policy stays invisible to `isEqualTo` — covered by hash identity; state it in the test name).
- D9 warning asserts (listener) for `@@map` policy lowering, batched semantics shared with indexes.

## Coherence rationale

The policy half of one already-shipped identity model, delivered as one PR: entity/mode change, authoring surface, equivalence, pairing, and warning are a single coherent adoption story ("a live policy can be signed and later renamed into management"). Slice 4 consumes it immediately.

## Scope

**In:** the above; docs touched by the policy authoring reference (policy block docs / RLS subsystem page if they enumerate block attributes); upgrade-skill entries per the coverage check.

**Deliberately out:** TS policy authoring (`map` descriptor — future work with that surface); infer emission (slice 4); RESTRICTIVE authoring (authoring stays `permissive: true`; the exact branch still compares `permissive` since inferred/live policies vary); any index-side change; renaming the five block kinds.

## Pre-investigated edge cases

| Case | Obligation |
| --- | --- |
| Introspection `?? policyname` fallback | Removed per § 4; its head-derivation role is slice-4 infer's, comment-marked. Check for any other consumer of actual-side policy `prefix` (rename pass groups by `parseWireName(name)`, not `prefix` — verify). |
| `permissive` hardcoded `true` at authoring | Exact comparison and phase-2 still compare it (live/inferred can be RESTRICTIVE); managed authoring unchanged. |
| Existing managed contracts (incl. Supabase policies) | Zero movement expected; the optional-prefix schema widening must not change canonical bytes of prefix-carrying policies. |
| Planner "not-equal unreachable" comment | Now false; comment replaced, mapping added, tested (scenario F). |
| Exact policy under additive-only with a same-name live policy | CREATE POLICY precheck collides — confirm the plan surfaces this sanely (existing precheck failure semantics; no new mechanism). |

## Slice-specific done conditions

1. Scenario C e2e (renames-only transition) and scenario F integration (drift → not-equal → drop+create/conflict) green, byte-asserted where stated.
2. PSL/managed byte-stability proven (fixtures unmoved; head-keyed duplicate checks untouched).
3. The D9 policy warning fires through the shared batch (one flush per build across indexes + policies).
4. Full standing gate (incl. `lint:throws`, `lint:framework-vocabulary`, `lint:skills`, `check:upgrade-coverage --mode pr`, `test:examples`).

## Open questions

None.

## References

Grounding (paths current on the slice-2 branch): `authoring.ts:87–93,146–263,393–511,792–834`, `psl-extension-block.ts:277–293`, `interpreter.ts:528,2200`, `postgres-rls-policy.ts`, `postgres-policy-schema-node.ts:44–100`, `postgres-validators.ts:10`, `entity-kinds.ts:13`, `postgres-contract-serializer.ts:79,136`, `control-adapter.ts:1247–1288,1435,1979`, `planner.ts:388–485,511–622,721–754`, `operations/rls.ts:142`, `op-factory-call.ts:1784`, `index-naming.ts:33–72,122–126`, `build-contract.ts:665,689,931,1351`, `framework-authoring.ts:187–195`, `rls-rename-planner.test.ts`, the adapter RLS integration suites.
