# Brief: D7 SQLite adapter composition

## Task

Integrate the settled SQLite codec descriptor protocol into bare, runtime-stack, and control-stack adapter construction. Runtime construction must become stack-aware; runtime and control must collect the same ordered target, adapter, and extension descriptor contributions, structurally validate them once before lowering, and derive one immutable coherent SQLite registry used for both ordinary codec materialization and target-specific behavior. Bare construction remains built-ins-only, and the authoritative registry must retain the full authored descriptor set—including char/varchar—even though existing control/emission metadata intentionally filters those descriptors.

## Scope

**In:** Tests first in `@prisma-next/adapter-sqlite`; runtime stack awareness; runtime/control contribution collection and exact set/order parity; one immutable SQLite registry derived from the validated descriptor set; built-ins-only bare construction; direct custom target-descriptor injection coherence if the adapter exposes such a path; structural rejection of raw generic, PostgreSQL/wrong-target, malformed, and duplicate contributions before lowering; full char/varchar inclusion independent of filtered control metadata; existing extension/parameter codec materialization and encoding; exact current SQL and JSON object/array pass-through; minimal package wiring only if required; touched cast/error/import policy; package and focused downstream validation.

**Out:** SQLite BLOB hex, bigint text, finite-real enforcement, JSON document retagging, or any codec JSON change; stored scalar-array semantics; invoking `jsonProjection` from renderers; PostgreSQL changes; generic framework/control-stack target threading; metadata removal; ORM planning; aggregate work; generic target maps/unions; generated contract/fixture changes; docs/upgrade instructions (D8); prototype/stash operations.

## Completed when

- [ ] Tests written first prove bare SQLite construction is built-ins-only while runtime/control construction sees the same complete ordered descriptor set from target, adapter, and extensions, including authored char/varchar descriptors omitted from filtered control metadata; the coherent registry is immutable.
- [ ] Raw generic, PostgreSQL/wrong-target, malformed, and duplicate descriptors reject synchronously during composition before query/migration lowering; no query-time structural target narrowing or parallel registry inputs can create split-brain behavior.
- [ ] Existing extension parameter materialization/encoding, BLOB base64, bigint safe-number behavior, structured JSON, and JSON object/array SQL remain unchanged; descriptor JSON hooks remain dormant.
- [ ] `pnpm --filter @prisma-next/adapter-sqlite test`, `typecheck`, and `lint` pass with focused target/runtime/control regressions, `pnpm lint:deps`, `pnpm lint:casts`, `pnpm lint:throws`, `pnpm fixtures:check`, and `git diff --check`; bounded `rg` scans prove no metadata removal, JSON behavior migration, generated drift, target branching, transient project IDs, or out-of-scope files entered the diff. Only D7 files are explicitly staged in a signed-off commit with no amend/push.

## Standing instruction

SQLite owns its target descriptor registry at adapter composition, but this slice does not invent a stored-array protocol or change JSON representations. Use the full authored descriptor contributions as the registry source; filtered control/emission metadata is not authoritative. Keep generic framework surfaces target-neutral and hide validated erasure behind the SQLite adapter boundary. Apply D6’s coherence lesson from the start: if direct custom injection exists, accept target descriptors or one coherent registry source rather than independently injectable generic and target lookups.

## References

- Slice spec: `projects/codec-json-projections/slices/02-target-codec-descriptor-foundations/spec.md` §§ Validated registries behind generic erasure, Behavior-preserving transition, Adapter impact.
- Amended slice plan: `projects/codec-json-projections/slices/02-target-codec-descriptor-foundations/plan.md` § Dispatch 7.
- SQLite protocol/built-ins: D2 commit `03322328234c8c269c54edb1bec1fc4bc114ec95`; D4 commit `7b0317518e4e79bb6e11d5b85c2b778b11b55f67`.
- PostgreSQL composition precedent and coherence correction: D6 commits `6f387bb06555ea70fd77310bccebd09f9324ef38`, `9740f0f7e6a363c3ce5ea6dbccf784d77330e5fa`.
- Current review scoreboard: `projects/codec-json-projections/reviews/code-review.md` — D6 SATISFIED, AC-3 pending D7.
- Rules: `.agents/skills/no-bare-casts/SKILL.md`, `.agents/rules/no-target-branches.mdc`, `.agents/rules/no-transient-project-ids-in-code.mdc`.
- Harness constraint: built-in search/grep/glob/find-path tools are forbidden. Use bounded terminal/bash `rg` and targeted `sed`/`cat` only.

## Operational metadata

- **Model tier:** persistent implementer/thorough — cross-plane stack composition, metadata-filter separation, and exact behavioral parity require repository-level judgment.
- **Time-box:** 90 minutes wall clock. Context/tool ceilings return a precise handoff without partial descope.
- **Halt conditions:** Runtime and control cannot obtain the same authored descriptor set without changing a generic public API; char/varchar inclusion conflicts with emitted metadata semantics; current codec JSON or SQL changes; a query-time target cast appears; generated fixture/contract drift appears; unrelated gate red; any destructive Git or `git stash*` action. Preserve the repository-global prototype stash.
