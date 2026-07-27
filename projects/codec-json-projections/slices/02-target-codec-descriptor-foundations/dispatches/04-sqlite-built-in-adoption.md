# Brief: D4 SQLite built-in adoption

## Task

Migrate the complete SQLite target-owned codec descriptor set to the D2 protocol without changing observable behavior. SQLite-native descriptor classes become `SqliteCodecDescriptor`s with explicit current-behavior scalar hooks; the four generic SQL-family descriptors are explicitly adapted with `sqliteCodec(...)`; canonical arrays are typed with `defineSqliteCodecs(...)`; and the package exposes a complete built-ins-only typed SQLite descriptor registry while preserving the existing generic registry, codec type maps, and control/emission descriptor filtering.

## Scope

**In:** Tests first for complete canonical descriptor coverage and no raw generic entries; migration of SQLite descriptor classes/instances and generic SQL adapters; canonical arrays, registry/type-map wiring, and target exports as required; explicit identity/pass-through scalar hooks; typed registry lookup; codec ID/trait/target/schema/factory/column-helper literal and generic preservation; current BLOB base64, bigint safe-number, real, datetime, and structured JSON behavior; registry order; explicit proof that `sql/char@1` and `sql/varchar@1` remain in the authored target registry while the existing control/emission metadata filter still omits them; touched cast/error policy.

**Out:** Adapter runtime/control stack awareness; invoking JSON hooks from renderers; changing SQL or codec JSON; BLOB hex, bigint text, finite-real validation, document retagging, or stored-array semantics; extensions; PostgreSQL; metadata removal; ORM planning; aggregates; fixture/contract regeneration; upgrade instructions; generic framework refactors; prototype/stash operations.

## Completed when

- [ ] Tests written first prove every canonical SQLite descriptor is target-typed, each generic SQL descriptor is explicitly adapted, raw descriptors are absent, registry/type-map order and membership remain intentional, and existing descriptor/column/factory types compile unchanged.
- [ ] Existing codec JSON/runtime assertions remain equivalent, direct scalar hooks are explicit identity/pass-through declarations, `many` remains rejected, and the typed registry contains char/varchar even though control/emission metadata deliberately excludes them.
- [ ] `@prisma-next/target-sqlite` build/test/typecheck/lint, downstream `@prisma-next/adapter-sqlite` typecheck, `pnpm lint:casts`, `pnpm lint:throws`, `pnpm lint:deps`, and `pnpm fixtures:check` pass with zero generated drift; bounded `rg` scans find no adapter/renderer/later-slice behavior.
- [ ] Only D4 files are explicitly staged in a signed-off commit; do not amend or push. The report enumerates migrated descriptor categories, filter/parity evidence, gates, and deferrals.

## Standing instruction

This is a mechanical adoption of the settled D2 protocol. Identity projection is intentionally transitional; do not “correct” BLOB, bigint, real, or JSON semantics yet. Keep the full authored descriptor set distinct from filtered control/emission metadata. If any descriptor cannot adopt the protocol without changing public factory/column types or current codec JSON, halt and surface the mismatch instead of adding hidden defaults, casts, or later-slice transforms.

## References

- Slice spec: `projects/codec-json-projections/slices/02-target-codec-descriptor-foundations/spec.md` §§ Built-in and extension adoption, Behavior-preserving transition.
- Slice plan: `projects/codec-json-projections/slices/02-target-codec-descriptor-foundations/plan.md` § Dispatch 4.
- D2 protocol commit: `03322328234c8c269c54edb1bec1fc4bc114ec95`.
- Existing SQLite descriptors/arrays/type maps/registry, `descriptor-meta.ts`, and current runtime/type tests are the parity source of truth.
- Rules: `.agents/skills/no-bare-casts/SKILL.md`, `.agents/rules/no-transient-project-ids-in-code.mdc`, `.agents/rules/no-target-branches.mdc`.
- Harness constraint: built-in search/grep/glob/find-path tools are forbidden. Use bounded terminal/bash `rg` and targeted `sed`/`cat` only.

## Operational metadata

- **Model tier:** persistent implementer/thorough — mechanical adoption with type-level, codec JSON, and filtered-metadata parity constraints.
- **Time-box:** 60 minutes wall clock. Context/tool ceilings return a precise handoff rather than partial descope.
- **Halt conditions:** any public factory/column type or codec JSON must change; char/varchar authored-registry inclusion conflicts with the existing filter; generated fixture/contract drift appears; adapter changes are needed; generic framework refactor required; unrelated gate red; any destructive Git or `git stash*` action. Preserve the repository-global prototype stash.
