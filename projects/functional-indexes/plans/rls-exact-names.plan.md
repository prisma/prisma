# Plan — Slice 3: `rls-exact-names`

**Spec:** [rls-exact-names.spec.md](../specs/rls-exact-names.spec.md). Branch `slice/rls-exact-names`, stacked on `slice/expression-index-authoring`. Same loop conventions and full standing gate per dispatch.

## Dispatch sequence

### 1 — Exact-capable policy substrate

**Outcome:** `prefix` optional across entity/node/validator with the wire-name constructor invariant; mode-selected `isEqualTo` (managed id-equality unchanged; exact branch compares operation/permissive/sorted-roles/bodies verbatim); introspection stamps `prefix` per the index convention (fallback removed, slice-4 comment); planner maps policy `not-equal` → drop+create (destructive-gated, conflict otherwise; "unreachable" comment replaced); `policyNodeToContractPolicy` tolerates absence. Nothing authors exact policies yet — managed behavior byte-identical, fixtures unmoved.

**Builds on:** slices 1–2 substrate. **Hands to:** exact policy nodes representable and comparable end-to-end.

### 2 — `@@map` authoring + D9 sink

**Outcome:** the five policy blocks accept `@@map` (native_enum mechanism; `PSL_POLICY_INVALID_MAP` via the contributed-code seam; head-keyed duplicate checks byte-unchanged; no cap on exact names); the generic warning sink lands on `AuthoringEntityContext` (family-neutral, stop-condition if it can't stay generic) and `@@map` policies push D9 hits into the shared per-build batch. Managed lowering byte-unchanged.

**Builds on:** dispatch 1. **Hands to:** exact policies authorable; warning batched with indexes.

### 3 — Content pairing + scenarios + docs

**Outcome:** phase-2 content pairing in the policy pass (`policyContentEqual`, verbatim bodies, deterministic, widening-only; index pass untouched); scenario C e2e (adopt → verify clean → swap to managed → renames-only plan → apply → verify clean) and scenario F integration (drift → not-equal → drop+create / conflict) green; planner-unit phase-2 cases ported from the index suite; docs + upgrade entries; DoD walk.

**Builds on:** dispatches 1–2. **Hands to:** slice-DoD met; PR-open (stacked on slice 2).

## Sizing notes

Three dispatches mirroring slice 2's shape: substrate first (invisible), authoring + warning second, pairing + acceptance third. Each lands with the full standing gate green; the only framework touch (warning sink) is isolated in dispatch 2 with a stop-condition.
