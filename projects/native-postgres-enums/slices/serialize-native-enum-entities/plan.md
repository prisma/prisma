# Dispatch plan — `serialize-native-enum-entities`

**Spec:** [`spec.md`](spec.md). Sequential, test-first. **Sequencing note:** builds on PR #944 (`describedNativeEnumOwnersByTypeName` + its test surface) — branch stacks on `infer-native-enum-adoption` until #944 merges, then rebases onto main.

## D1 — `entity-through-json`

- **Outcome:** `entries.native_enum` is an ordinary enumerable entries kind: it serializes into `contract.json` via the generic entries path, hydrates back through `hydrateNamespaceEntities`, and is captured by `storageHash` — with a serialize→JSON→hydrate round-trip test proving entity equality (ordered members, `typeName`, `control`) and hash/bytes coherence, an absent-key tolerance test (old contracts hydrate unchanged), and an enum-free byte-identity regression pin.
- **Builds on:** — (branch base).
- **Hands to:** a durable entity D2 can hydrate from real pack artifacts.
- **Focus:** delete the non-enumerable carve-out in `postgres-schema.ts` (~86–107) including its now-obsolete comment; confirm the generic serializer needs no edit (report if it does); admit the key in `postgres-validators.ts` if the structure validator is closed; invert the absence assertions in `postgres-contract-serializer.test.ts`. Local fixture fallout (target-postgres package tests) is D1's to fix; repo-wide artifact regeneration is D3's.
- **Completed when:** round-trip + tolerance + byte-identity tests green; `pnpm typecheck` green; target-postgres package tests green.

## D2 — `hydrated-pack-subtraction`

- **Outcome:** the shipped slice's subtraction works production-shaped: an infer-entry test hydrates a described contract from serialized JSON (the Supabase pack shape: `auth`-namespaced `native_enum` + enum-typed column) and proves `contract infer` omits the pack-owned type — plus bookkeeping: the shipped slice's spec § Follow-ups entry is marked resolved by this slice, and this slice is linked from the project [`plan.md`](../../plan.md).
- **Builds on:** D1.
- **Hands to:** the proven mechanism D3 regenerates artifacts against.
- **Focus:** the test constructs its described contract via serialize→hydrate (not in-memory handoff) — that is the point; reuse the subtraction test surface from PR #944. Doc edits surgical.
- **Completed when:** hydrated-subtraction test green at the infer entry; docs committed; `pnpm typecheck` green.

## D3 — `artifact-regeneration-and-gates`

- **Outcome:** every checked-in artifact the byte/hash change touches is regenerated and the drift is verified to be exactly the intended shape (added `entries.native_enum` + moved hashes on enum-bearing contracts; nothing else): Supabase pack `contract.{json,d.ts}`, parity `expected.contract.json`, emit fixtures, example migration ledgers (`regen-example-migrations.mjs`) — then the full slice gate.
- **Builds on:** D1 + D2.
- **Hands to:** PR-open.
- **Focus:** regenerate via the sanctioned tools (never hand-edit contract fixtures — repo rule); review each diff hunk against the intended-drift shape before committing; PSL↔TS parity must pass after regeneration (a failure is a real asymmetry — stop and report, don't re-regenerate). Full gates, rebuild first, logs on disk: `pnpm build`, `pnpm typecheck`, `lint:casts`, `lint:deps`, `lint:framework-vocabulary`, `pnpm fixtures:check` (clean post-regen), `pnpm test:packages`, `pnpm test:integration`, plus the Supabase example suite (ledger re-sign verification).
- **Completed when:** all gates green with logs, drift review recorded in the dispatch report, orchestrator independently re-runs the gates before PR-open.
