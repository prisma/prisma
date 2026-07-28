# Brief: D5 PostgreSQL extension adoption

## Task

Migrate the PostgreSQL-bound pgvector, PostGIS, and arktype-json codec contributions to the settled PostgreSQL descriptor protocol before adapter composition starts rejecting raw descriptors. Each extension's canonical descriptor array must be target-typed, its descriptor classes/adapters must expose explicit current native-type and identity scalar-projection behavior, and its runtime/control contributions must keep using the same descriptor instances. Add the lean target-postgres runtime dependency and lockfile entries while preserving every public codec, factory, column-helper, contract-space, control-hook, and codec JSON behavior.

## Scope

**In:** Tests first in all three extension packages; descriptor class/adapter migration; `definePostgresCodecs(...)` on canonical arrays; structural discriminant and typed registry compatibility; runtime/control contribution identity; current native-type/meta parity; pgvector length, PostGIS SRID/type behavior, and arktype schema-inferred column typing; current vector-text, HEXEWKB, and structured JSON representations; target-postgres lean descriptor-subpath dependencies in package manifests; lockfile; missing PostGIS compile-time descriptor coverage; touched cast/error/import policy; package/dependency/fixture validation.

**Out:** PostgreSQL adapter composition or renderer wiring; JSON projection execution; vector arrays, GeoJSON, arktype document retagging, or any canonical JSON change; metadata removal; generic framework changes; SQLite; ORM planning; aggregates; conformance testkits; target adapter runtime dependencies; upgrade instructions/docs (D8); generated fixture/contract changes; prototype/stash operations.

## Completed when

- [ ] Tests written first prove each extension contributes only `PostgresCodecDescriptor`s through runtime and control arrays, preserves descriptor/factory/column generic types, and exposes existing native-type plus explicit identity scalar hooks without changing codec JSON.
- [ ] pgvector, PostGIS, and arktype-json package tests/typechecks/lints pass; PostGIS's current unparameterized column path and required-SRID paths remain behaviorally compatible without hidden defaults or widened application types.
- [ ] Target-postgres is a correctly layered runtime dependency through the lean descriptor subpath; `pnpm lint:manifests`, `pnpm lint:deps`, lockfile validation, `pnpm lint:casts`, `pnpm lint:throws`, and `pnpm fixtures:check` pass with zero generated drift. `pnpm check:upgrade-coverage --mode pr` may remain red only for the expected missing D8 declaration and must be reported, not bypassed.
- [ ] Bounded `rg` scans find no raw generic descriptor in the three canonical arrays, adapter/renderer/later-slice behavior, metadata removal, or project-path leak; only D5 files are explicitly staged in a signed-off commit with no amend/push.

## Standing instruction

This is a behavior-preserving extension adoption, not a projection-format migration. Preserve the extension descriptors' current factory and column-helper semantics exactly. If PostGIS parameter validation reveals that existing unparameterized columns cannot coexist with the target protocol without a public semantic change, halt for discussion rather than inventing an SRID/default, weakening validation, or adding a cast. Do not begin adapter validation until all three extension arrays are target-typed.

## References

- Slice spec: `projects/codec-json-projections/slices/02-target-codec-descriptor-foundations/spec.md` §§ Built-in and extension adoption, Open Question 3.
- Amended slice plan: `projects/codec-json-projections/slices/02-target-codec-descriptor-foundations/plan.md` § Dispatch 5.
- PostgreSQL protocol/built-ins: D1 commits `5f0bf523522b4da998b3a9efcc52662596ef4ca8`, `0eb83c8fac26426a04425ba26e3d9d37d28c77c3`; D3 commit `885436dd2033cd2da56d2921bafed9397236949a`.
- Upgrade guidance is intentionally D8, but this dispatch must preserve enough exact substrate evidence for validation-by-execution.
- Rules: `.agents/skills/no-bare-casts/SKILL.md`, `.agents/skills/record-upgrade-instructions/SKILL.md`, `.agents/rules/no-transient-project-ids-in-code.mdc`, `.agents/rules/no-target-branches.mdc`.
- Harness constraint: built-in search/grep/glob/find-path tools are forbidden. Use bounded terminal/bash `rg` and targeted `sed`/`cat` only.

## Operational metadata

- **Model tier:** persistent implementer/thorough — multi-package mechanical migration with generic/type-parameter compatibility and dependency judgment.
- **Time-box:** 90 minutes wall clock. Context/tool ceilings return a precise handoff without partial descope.
- **Halt conditions:** PostGIS or arktype public types must change; current codec JSON/native-type/meta parity fails; target import layering is invalid; adapter changes are required; generated fixture/contract drift appears; an unexpected upgrade-coverage failure beyond the missing declaration appears; unrelated gate red; any destructive Git or `git stash*` action. Preserve the repository-global prototype stash.
