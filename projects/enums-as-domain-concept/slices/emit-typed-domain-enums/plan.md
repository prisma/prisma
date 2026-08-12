# Dispatch plan — emit-typed-domain-enums (TML-2885)

Slice spec: [`./spec.md`](./spec.md). **One dispatch** — the emitter change, its
emit-then-consume proof, and the demo simplification are one outcome (the demo cast
deletion *is* the acceptance evidence, not separate work); the diff is small and the
slice-DoD checklist is the gate. Branch `tml-2885-…` stacked on the `tml-2855-…` tip
(unattended decision #6). Implementer: sonnet-mid; reviewer: opus.

### Dispatch 1: emit the typed domain enum block + demo proof + sweep

- **Outcome:** the emitted `contract.d.ts` carries the per-namespace `enum` block
  (literal `codecId`, ordered literal member tuples); the existing accessor chain
  resolves `db.enums.<ns>.<Name>.values`/`.members` to literals through emit
  (emit-then-consume type test, non-vacuous, incl. one int-codec enum and key-quoting
  edge); the demo regenerates and `getPriorityEnumFromEmit` + the `priorityValue`
  blindCast are deleted (direct `db.enums.public.Priority` consumption, no casts);
  a demo type test proves the literals through the emitted artifacts;
  `contract.json` byte-identical; slice sweep green (`test:packages`, full
  `typecheck`, `fixtures:check` clean outside the regenerated `.d.ts` files,
  `lint:deps`, cast ratchet **decreases** by the two deleted blindCasts).
- **Builds on:** TML-2852 D4's literal-rendering helpers (reuse); TML-2882/2855's
  demo enum (the proving ground); `enum-accessor.ts`'s already-correct target shape.
- **Hands to:** R6 honest through emit — with TML-2855, the cutover's parity
  prerequisites complete.
- **Focus:** `emitter/src/generate-contract-dts.ts` (the namespace-type builder);
  emitter tests; demo `get-posts-by-priority.ts` + `main.ts` touchpoints +
  regenerated artifacts. **Out:** `enum-accessor.ts` (untouched), field narrowing
  (untouched), runtime changes (none).
