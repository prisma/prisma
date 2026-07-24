# Plan — Slice 4: `infer-round-trip`

**Spec:** [infer-round-trip.spec.md](../specs/infer-round-trip.spec.md). Branch `slice/infer-round-trip`, stacked on `slice/rls-exact-names`. Same loop conventions and full standing gate per dispatch. This slice completes the project DoD; close-out is a separate final PR.

## Dispatch sequence

### 1 — Indexes round-trip at full fidelity

**Outcome:** infer emits every non-constraint index (skip guard and unique-gate deleted) with managed re-detection (`name:` when the wire hash recomputes, `map:` otherwise), full-matrix args via the restructured builder, the btree edge documented; the duplicate guard keys exact entries by name (twin databases signable). Policies untouched. Fields-only re-detection pinned byte-identically; expression/partial/unique-index emission pinned against real introspection.

**Builds on:** slices 1–3. **Hands to:** index half of scenario A provable.

### 2 — Policies and `@@rls` round-trip

**Outcome:** policy blocks emit per spec § 3 (sanitized disambiguated heads, `@@map` always, verbatim bodies, roles as-is, skip-with-note for unauthorable); `permissive` becomes an authorable block property (spec § 4, three hardcoded sites threaded, managed hashes byte-unchanged, stop-condition on spread); `@@rls` emits natively; the Supabase harness's `applyRlsEnablement` is deleted and the contract regenerated (transitional partial-index omission ends; movement explained against § 5's expectations; `CONTRACT-FIDELITY.md` updated).

**Builds on:** dispatch 1. **Hands to:** everything scenario A needs emitted.

### 3 — The project DoD

**Outcome:** DoD-2 sign-the-database e2e (incl. one RESTRICTIVE policy), DoD-3 transition e2e (exactly two renames), DoD-4 referenced, DoD-5 scenario A–J walk in the report; re-infer stability + fidelity suites extended; docs + upgrade entries; full standing gate.

**Builds on:** dispatches 1–2. **Hands to:** slice-DoD and project-DoD items 1–6 met; PR-open (stacked on slice 3). Close-out PR follows separately.

## Sizing notes

Three dispatches: the index half (mechanical once the builder branches), the policy half (the judgment core — sanitization, permissive, harness regen), acceptance. Sequential-green holds: dispatch 1 changes only index emission (existing suites pin fields-only behavior), dispatch 2 adds emissions nothing consumes until the journeys, dispatch 3 proves the whole.
