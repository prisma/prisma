# Brief: D3 PostgreSQL built-in adoption

## Task

Migrate the complete PostgreSQL target-owned codec descriptor set to the D1 protocol without changing observable behavior. PostgreSQL-native descriptor classes become `PostgresCodecDescriptor`s with explicit current-behavior native-type and scalar-projection hooks; the six generic SQL-family descriptors are explicitly adapted with `postgresCodec(...)`; canonical arrays are typed with `definePostgresCodecs(...)`; and the package exposes a complete built-ins-only typed PostgreSQL descriptor registry while preserving the existing generic codec registry and emitted codec-type map semantics.

## Scope

**In:** Tests first for complete canonical descriptor coverage and no raw generic entries; migration of PostgreSQL descriptor classes/instances, aliases, generic SQL adapters, `PgEnumDescriptor`, canonical arrays, registry/type-map wiring, and target package exports as required; explicit identity/pass-through scalar hooks for current behavior; current trusted native-type results; typed registry lookup; codec ID/trait/target/schema/factory/column-helper literal and generic preservation; transitional `meta`/`metaFor` parity; current codec JSON parity; registry order and intentional registry-vs-emitted-map differences; touched cast/error policy.

**Out:** Adapter runtime/control construction; switching `renderTypedParam`; invoking JSON hooks from renderers; changing array SQL execution; extension migration; SQLite; metadata removal; codec JSON changes; ORM planning; aggregates; fixtures/contracts regeneration; upgrade instructions; generic framework refactors; prototype/stash operations.

## Completed when

- [ ] Tests written first prove every canonical PostgreSQL descriptor is target-typed, each generic SQL descriptor is explicitly adapted, raw descriptors are absent, registry order and emitted type-map membership remain intentional, and existing descriptor/column/factory types compile unchanged.
- [ ] Existing metadata/native-type results—including parameterized enum behavior—and all current codec JSON/runtime helper assertions remain equivalent; direct scalar hooks are explicit current-behavior identity/pass-through declarations and do not affect renderer output.
- [ ] `@prisma-next/target-postgres` build/test/typecheck/lint, downstream `@prisma-next/adapter-postgres` typecheck, `pnpm lint:casts`, `pnpm lint:throws`, `pnpm lint:deps`, and `pnpm fixtures:check` pass with zero generated drift; bounded `rg` scope scans find no adapter/extension/later-slice behavior.
- [ ] Only D3 files are explicitly staged in a signed-off commit; do not amend or push. The report enumerates migrated descriptor categories, parity evidence, gates, and deferrals.

## Standing instruction

This is a mechanical adoption of the settled D1 protocol with behavior-parity judgment centralized in current native-type/meta/codec tests. Do not “correct” lossy numeric/int8 JSON, bytea text, temporal shapes, or array projections yet. Preserve the deliberate difference between descriptors available in the runtime registry and descriptors exposed through emitted codec type maps. If any descriptor cannot adopt the protocol without changing its public factory/column semantics or metadata, halt and surface the specific mismatch rather than adding compatibility casts or widening types.

## References

- Slice spec: `projects/codec-json-projections/slices/02-target-codec-descriptor-foundations/spec.md` §§ Built-in and extension adoption, Behavior-preserving transition.
- Slice plan: `projects/codec-json-projections/slices/02-target-codec-descriptor-foundations/plan.md` § Dispatch 3.
- D1 protocol commits: `5f0bf523522b4da998b3a9efcc52662596ef4ca8`, `0eb83c8fac26426a04425ba26e3d9d37d28c77c3`.
- Current PostgreSQL descriptors/arrays/type maps/registry and their existing runtime/type tests are the parity source of truth.
- Rules: `.agents/skills/no-bare-casts/SKILL.md`, `.agents/rules/no-transient-project-ids-in-code.mdc`, `.agents/rules/no-target-branches.mdc`.
- Harness constraint: built-in search/grep/glob/find-path tools are forbidden. Use bounded terminal/bash `rg` and targeted `sed`/`cat` only.

## Operational metadata

- **Model tier:** persistent implementer/thorough — broad mechanical adoption with type-level and metadata parity constraints.
- **Time-box:** 90 minutes wall clock. Context/tool ceilings return a precise handoff rather than partial descope.
- **Halt conditions:** any public factory/column type must change; metadata/native-type or codec JSON parity fails; generated fixture/contract drift appears; adapter/extension changes are needed; generic framework refactor required; unrelated gate red; any destructive Git or `git stash*` action. Preserve the repository-global prototype stash.
