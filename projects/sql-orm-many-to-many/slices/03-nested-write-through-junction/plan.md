# Slice 3: nested writes through the junction — Dispatch plan

**Spec:** `projects/sql-orm-many-to-many/slices/03-nested-write-through-junction/spec.md`
**Linear:** [TML-2787](https://linear.app/prisma-company/issue/TML-2787)

Four dispatches. Runtime write path first (pure junction), then the required-payload fixture, then the type+runtime disable (the risk dispatch — operator-mandated in-slice), then integration tests. The two judgment-heavy dispatches (D1 routing, D3 conditional types) go to a higher model tier given the slice-1/2 truncation pattern + the type-level complexity.

### Dispatch 1: runtime junction write path

- **Outcome:** `connect`/`disconnect`/`create` over the pure M:N relation route to junction INSERT/DELETE (create = target-insert + link), under both `create()` and `update()`; the `partitionByOwnership` `'N:M not supported'` guard is removed and replaced with a `junctionOwned` bucket; the rejection unit test is flipped to a positive assertion. Unit-tested.
- **Builds on:** slice 0's `ResolvedRelation.through`; the existing parent/child ownership flows in `mutation-executor.ts`.
- **Hands to:** a working M:N write path (pure junction) — what D4 verifies on the DB and D3 layers the guard onto.
- **Focus:** `partitionByOwnership` + the junction-owned branch in the `create()`/`update()` graph flows (`mutation-executor.ts`); composite-key INSERT/DELETE; flip the rejection test. **Model: opus.**

### Dispatch 2: required-payload-junction fixture

- **Outcome:** the integration fixture gains a second M:N relation whose junction has a **required non-FK column** — e.g. `User ↔ Role` via `UserRole(user_id, role_id, level NOT NULL)` — re-emitted; `requiredPayloadColumns` resolves to `['level']` for it.
- **Builds on:** slice 0's `through` + `requiredPayloadColumns` derivation.
- **Hands to:** a required-payload junction — the fixture D3's disable + D4's disable test need.
- **Focus:** fixture source + re-emit (same `tsx`-bypass + golden-diff verification as slice 1's fixture dispatch; CI `fixtures:check` is the real gate). **Model: sonnet.**

### Dispatch 3: type-level + runtime `.create` disable on required-payload junctions

- **Outcome:** nested `.create` through an M:N relation whose junction has required payload columns is rejected **at the type level** (a negative type test proves `.create` input is `never` / unavailable) **and at runtime** (a clear error naming the columns + pointing to the junction model / SQL builder); `connect`/`disconnect` on that relation still work.
- **Builds on:** D1's junction write path + D2's required-payload fixture.
- **Hands to:** the safety rail — the slice's hard DoD item.
- **Focus:** the runtime guard in the junction-owned `create` branch (uses `requiredPayloadColumns`); the type-level disable on the relation-mutator `create` input. **Risk:** the `.d.ts` `through` type may not carry required-payload info — derive from junction field types, or **halt + surface** (possible slice-0 contract extension = operator decision). **Model: opus.**

### Dispatch 4: write integration tests (operator standard)

- **Outcome:** integration tests (PGlite) prove connect/disconnect/create on the pure junction (readback via `include('tags')`), under both flows, AND the runtime disable on the required-payload junction — whole-row `toEqual`, explicit `.select` in most, ≥1 implicit.
- **Builds on:** D1 (write path) + D2 (fixtures) + D3 (disable).
- **Hands to:** the slice-DoD-satisfying write coverage.
- **Focus:** new integration test file; reuse slice 1's seed helpers, add `Role`/`UserRole` seeds. Run via `cd test/integration && pnpm test test/sql-orm-client/<file>`. **Model: sonnet.**

## Handoff completeness

Slice-DoD reachable: junction writes both flows + rejection-test flip (D1 + D4) · required-payload disable types+runtime (D3, fixture from D2) · standard integration coverage (D4). D3's type-disable is the operator's non-negotiable item; its feasibility risk is pre-named with a halt.
