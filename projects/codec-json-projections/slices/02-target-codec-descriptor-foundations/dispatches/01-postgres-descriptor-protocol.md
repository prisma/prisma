# Brief: D1 PostgreSQL descriptor protocol

## Task

Add the public PostgreSQL target codec descriptor protocol in `@prisma-next/target-postgres`: a real `PostgresCodecDescriptor<P>` base with a stable structural discriminant, validated erased-to-typed template methods, explicit native-type and scalar JSON projection hooks, the default overridable single-evaluation array lift, a `postgresCodec(...)` adapter that preserves the complete wrapped descriptor contract, a tuple-preserving `definePostgresCodecs(...)` helper, and a structurally validated typed registry. This dispatch establishes and tests the protocol only; no built-in, adapter, or extension migration occurs yet.

## Scope

**In:** Tests first; positive and negative `.test-d.ts` authoring coverage; descriptor discriminant and structural validation; synchronous `CodecRef.typeParams` validation before typed hooks; mandatory scalar projection; trusted-string native type; compositional default array lift using the existing relational AST with one source binding and null/empty/null-element/order preservation; optional equivalent array override; adapter delegation of codec ID/traits/target types/schema/factory/renderers/transitional metadata; literal/factory/result type preservation; tuple helper; duplicate/wrong-target/malformed registry rejection; immutable registry lookup; lean public export; touched production cast/error policy.

**Out:** Migrating PostgreSQL built-ins or generic descriptor arrays; changing codec/type maps; adapter/runtime/control wiring; invoking JSON hooks from renderers; changing parameter SQL; pgvector/PostGIS/arktype-json; metadata removal; codec JSON changes; ORM planning; SQLite; aggregate behavior; fixtures/contracts; upgrade instructions; raw SQL; prototype code or stash operations; generic framework target maps or `ControlStack` specialization.

## Completed when

- [ ] Test-first runtime/type coverage proves raw generic descriptors are rejected by `definePostgresCodecs`, adapted/direct target descriptors preserve literal and factory types, scalar/native hooks are mandatory, erased refs are validated before typed hooks, structural validation works without `instanceof`, and malformed/duplicate registries fail clearly.
- [ ] The default array projection is represented compositionally without raw SQL, binds the input once, and structurally preserves null array, empty array, null elements, and order; an override is accepted only through the same typed parameter boundary.
- [ ] `@prisma-next/target-postgres` build/test/typecheck/lint plus `pnpm lint:casts`, `pnpm lint:throws`, and `pnpm lint:deps` pass; closing bounded `rg` scans show no built-in/adapter/extension migration or later-slice behavior.
- [ ] Only D1 files are explicitly staged in a signed-off commit; do not amend or push. The report lists API/export choices, tests, gate results, and any deferral.

## Standing instruction

Stay focused on the PostgreSQL protocol and typed registry as one target-package feature. Preserve the wrapped descriptor's established factory/codec-instance behavior rather than rebinding it speculatively. If the existing AST cannot express a single-evaluation array lift, trusted native-type strings cannot preserve current semantics, wrapper typing requires widening or a generic framework refactor, or a lean public export violates dependency layering, halt and surface the design issue instead of adding raw SQL, casts, central target knowledge, or consumer migration.

## References

- Slice spec: `projects/codec-json-projections/slices/02-target-codec-descriptor-foundations/spec.md` §§ Public target descriptor protocols, Generic codec adaptation, Validated registries, Open Questions.
- Slice plan: `projects/codec-json-projections/slices/02-target-codec-descriptor-foundations/plan.md` § Dispatch 1.
- Parent design checkpoint: `projects/codec-json-projections/assets/codec-json-projection-design-checkpoint.md` §§ 3–6 and 11.
- Predecessor API: TML-3062 / PR #1023; current stacked base HEAD is the branch point.
- Existing validation primitive: `validateCodecTypeParams` in framework components; reuse its Standard Schema behavior.
- Rules: `.agents/skills/no-bare-casts/SKILL.md`, `.agents/rules/no-transient-project-ids-in-code.mdc`, `.agents/rules/no-target-branches.mdc`.
- Harness constraint: built-in search/grep/glob/find-path tools are forbidden. Use bounded terminal/bash `rg` for all discovery and `sed`/`cat` only for targeted reads.

## Operational metadata

- **Model tier:** persistent implementer/thorough — public generic typing, structural validation, and compositional array semantics require judgment.
- **Time-box:** 90 minutes wall clock. A context or tool ceiling returns a precise handoff; it does not widen scope.
- **Halt conditions:** any standing-instruction boundary above; a new relational AST node is required; async parameter validation appears necessary; production renderer/codec JSON behavior changes; fixtures/contracts drift; a gate is red for an unclear reason; any destructive Git or `git stash*` action. Preserve the repository-global prototype stash.
