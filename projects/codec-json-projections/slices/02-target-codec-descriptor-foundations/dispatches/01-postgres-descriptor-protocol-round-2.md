# Brief: D1 PostgreSQL descriptor protocol — round 2

## Task

Close reviewer findings F1 and F2 without changing the accepted D1 protocol shape. Make the adapted descriptor's public type expose only the ordinary `CodecDescriptor` surface with preserved codec/trait/target/factory literals plus the PostgreSQL protocol, rather than promising arbitrary concrete members the adapter does not implement. Tighten structural validation so a descriptor's Standard Schema includes a callable `~standard.validate` before it can enter the typed registry.

## Scope

**In:** Tests first for the public type/runtime honesty gap and malformed-schema acceptance; the narrow adapter result type; structural Standard Schema method validation; directly affected protocol tests/type tests; target-postgres build/test/typecheck/lint and root cast/throw/dependency gates.

**Out:** Reworking wrapper runtime delegation that already passed review; default array-lift changes; built-in/adapter/extension adoption; generic framework refactors; compatibility exports; renderer or codec JSON behavior; unrelated cleanup; project artifact edits.

## Completed when

- [ ] Type tests prove adapted descriptors preserve ordinary codec/trait/target/factory literal information while no longer exposing arbitrary subclass-only fields or methods absent from the adapter instance.
- [ ] Runtime tests prove structurally valid descriptors remain accepted across module identity while missing/non-callable `~standard.validate` schemas are rejected during registry construction.
- [ ] Focused and complete target-postgres gates plus `pnpm lint:casts`, `pnpm lint:throws`, `pnpm lint:deps`, scope scans, and `git diff --check` pass; a signed-off explicit-staging commit contains only the correction.

## Standing instruction

Fix the type contract and schema shape at their definitions, not with casts or test-only workarounds. Preserve every D1 behavior already accepted by the reviewer. If honest literal/factory preservation requires exposing arbitrary concrete members or changing generic framework descriptor types, halt and surface the design conflict.

## Operational metadata

- **Model tier:** persistent implementer/thorough — resumed context, narrow generic-type and runtime-validator correction.
- **Time-box:** 30 minutes wall clock.
- **Halt conditions:** any production behavior beyond F1/F2 must change; generic framework refactor required; target package API must widen; unrelated gate red; any destructive Git or `git stash*` action. Built-in search tools remain forbidden; use bounded terminal/bash `rg` and targeted `sed`/`cat` only.
