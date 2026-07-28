# Brief: D6 PostgreSQL adapter composition

## Task

Integrate the settled PostgreSQL codec descriptor protocol into bare, runtime-stack, and control-stack adapter construction. Each construction path must assemble and structurally validate the complete PostgreSQL descriptor contribution set exactly once before lowering, expose one immutable typed registry to downstream PostgreSQL adapter code, and use that registry for parameter native-type rendering with byte-identical existing SQL. Bare construction remains built-ins-only; stack-aware construction includes valid extension descriptors and rejects malformed, wrong-target, or duplicate contributions before query or migration lowering begins.

## Scope

**In:** Tests first in `@prisma-next/adapter-postgres`; adapter runtime/control composition and constructor plumbing; immutable `PostgresCodecRegistry` construction from built-ins plus stack contributions; built-ins-only bare factory behavior; complete runtime/control extension visibility and ordering; structural rejection timing for malformed/wrong-target descriptors and duplicate IDs; PostgreSQL parameter native-type lookup through target descriptors; exact enum, custom, scalar-array, and no-cast SQL parity; unchanged generic codec materialization and DDL behavior; unchanged JSON object/array rendering; minimal manifest/lockfile changes only if required by correct package layering; touched cast/error/import policy; package and focused downstream validation.

**Out:** Invoking `jsonProjection` or `jsonArrayProjection` from renderers; changing any codec JSON representation; adding numeric, money, bytea, vector, PostGIS, or array JSON casts/transforms; ORM projection planning; SQLite composition (D7); metadata or `metaFor` removal; descriptor API redesign; extension descriptor migration already completed in D5; aggregate work; generic target maps/unions; lineage reconstruction; generated contract/fixture changes; docs/upgrade instructions (D8); prototype/stash operations.

## Completed when

- [ ] Tests written first prove bare PostgreSQL adapter construction is built-ins-only, runtime/control construction sees the same complete target descriptor set including pgvector/PostGIS/arktype-json contributions, and the resulting registry is immutable.
- [ ] Composition rejects malformed, SQLite/wrong-target, and duplicate-ID contributions before lowering; production query/migration paths do not perform a target-descriptor narrowing cast.
- [ ] Parameter native-type rendering resolves through the validated PostgreSQL registry while existing enum, custom, scalar-array, and no-cast SQL remains byte-identical; generic codec materialization, DDL, and JSON object/array SQL remain unchanged and descriptor JSON hooks stay dormant.
- [ ] `pnpm --filter @prisma-next/adapter-postgres test`, `typecheck`, and `lint` pass together with focused target/extension regressions, `pnpm lint:deps`, `pnpm lint:casts`, `pnpm lint:throws`, `pnpm fixtures:check`, and `git diff --check`; bounded `rg` scans prove no metadata removal, renderer projection wiring, generated drift, transient project IDs, or out-of-scope target branch entered the diff. Only D6 files are explicitly staged in a signed-off commit with no amend/push.

## Standing instruction

This dispatch moves validation and native-type ownership to the PostgreSQL adapter composition boundary without changing observable SQL or JSON behavior. Prefer type erasure behind the target adapter boundary over threading PostgreSQL descriptor types through generic `ControlStack`/`ComponentMetadata` APIs, but keep every user-facing target API type-safe. Preserve generic `meta`/`metaFor` until TML-3063. If one runtime/control path cannot validate before lowering without changing a generic public API, or native-type registry lookup cannot preserve exact current SQL, halt and surface the boundary rather than adding a query-time cast, codec-ID branch, target map, or fallback to unvalidated metadata.

## References

- Slice spec: `projects/codec-json-projections/slices/02-target-codec-descriptor-foundations/spec.md` §§ Adapter integration, Transitional metadata coexistence, Non-goals, Acceptance criteria.
- Amended slice plan: `projects/codec-json-projections/slices/02-target-codec-descriptor-foundations/plan.md` § Dispatch 6.
- PostgreSQL protocol/registry: D1 commits `5f0bf523522b4da998b3a9efcc52662596ef4ca8`, `0eb83c8fac26426a04425ba26e3d9d37d28c77c3`.
- PostgreSQL built-ins/extensions: D3 commit `885436dd2033cd2da56d2921bafed9397236949a`; D5 commit `942adde31c680e4617c1b173ce85f4b3bcdc24c1`.
- Current review scoreboard: `projects/codec-json-projections/reviews/code-review.md` — D5 SATISFIED, AC-3 owned by D6–D7.
- Rules: `.agents/skills/no-bare-casts/SKILL.md`, `.agents/rules/no-target-branches.mdc`, `.agents/rules/no-transient-project-ids-in-code.mdc`.
- Harness constraint: built-in search/grep/glob/find-path tools are forbidden. Use bounded terminal/bash `rg` and targeted `sed`/`cat` only.

## Operational metadata

- **Model tier:** persistent implementer/thorough — cross-plane composition, validation timing, type erasure, and exact SQL parity require repository-level judgment.
- **Time-box:** 90 minutes wall clock. Context/tool ceilings return a precise handoff without partial descope.
- **Halt conditions:** A generic public control/runtime API must become target-specific; parameter SQL parity fails; JSON renderer behavior must change; a target cast appears in a query-time path; extension contributions cannot be validated at composition; generated fixture/contract drift appears; unrelated gate red; any destructive Git or `git stash*` action. Preserve the repository-global prototype stash.
