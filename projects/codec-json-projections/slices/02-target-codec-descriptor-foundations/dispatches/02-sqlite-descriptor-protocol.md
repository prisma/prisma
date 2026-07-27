# Brief: D2 SQLite descriptor protocol

## Task

Add the public SQLite target codec descriptor protocol in `@prisma-next/target-sqlite`, following D1's proven authoring/erasure conventions without importing PostgreSQL semantics: a real `SqliteCodecDescriptor<P>` base with a stable structural discriminant, validated erased-to-typed scalar projection method, a `sqliteCodec(...)` adapter that preserves the complete ordinary descriptor contract honestly, a tuple-preserving `defineSqliteCodecs(...)` helper, and a structurally validated immutable typed registry. SQLite has no stored scalar-array protocol in this slice; a scalar template call with `CodecRef.many` must fail clearly rather than projecting the whole stored array.

## Scope

**In:** Tests first; positive/negative `.test-d.ts` authoring coverage; descriptor discriminant and structural validation; synchronous `CodecRef.typeParams` validation before the typed scalar hook; mandatory explicit scalar projection; clear rejection of `many`; adapter delegation of codec ID/traits/target types/schema/factory/renderers/transitional metadata; ordinary-surface type honesty and literal/factory/result preservation; tuple helper; duplicate/wrong-target/malformed registry rejection including callable Standard Schema validation; immutable registry; lean public export; touched production cast/error policy.

**Out:** PostgreSQL native-type/array behavior; migrating SQLite built-ins or generic descriptor arrays; adapter/runtime/control wiring; invoking JSON hooks from renderers; changing SQL or codec JSON; extension adoption; metadata removal; ORM planning; aggregates; fixtures/contracts; upgrade instructions; generic framework target maps/refactors; prototype or stash operations.

## Completed when

- [ ] Test-first runtime/type coverage proves raw generic descriptors are rejected, adapted/direct target descriptors preserve ordinary literal/factory signatures without promising unimplemented concrete members, scalar projection is mandatory, refs are validated before typed hooks, `many` fails clearly, and structural registry validation rejects malformed/duplicate/wrong-target descriptors without `instanceof`.
- [ ] The SQLite protocol contains no PostgreSQL native-type or stored-array hook and all adapter delegation/registry exports remain target-package-local and immutable.
- [ ] `@prisma-next/target-sqlite` build/test/typecheck/lint plus `pnpm lint:casts`, `pnpm lint:throws`, and `pnpm lint:deps` pass; closing bounded `rg` scans show no built-in/adapter migration or later-slice behavior.
- [ ] Only D2 files are explicitly staged in a signed-off commit; do not amend or push. The report lists API/export choices, tests, gates, and deferrals.

## Standing instruction

Reuse D1's honest ordinary-surface typing, complete delegation, callable-schema structural check, and registry pattern where they fit, but do not extract a central target map or imitate PostgreSQL-specific behavior. If consistency requires widening generic framework types, adding speculative SQLite array semantics, or changing current SQLite SQL/codec behavior, halt instead of broadening the dispatch.

## References

- Slice spec: `projects/codec-json-projections/slices/02-target-codec-descriptor-foundations/spec.md` §§ Public target descriptor protocols, Generic codec adaptation, Validated registries.
- Slice plan: `projects/codec-json-projections/slices/02-target-codec-descriptor-foundations/plan.md` § Dispatch 2.
- D1 stable implementation: commits `5f0bf523522b4da998b3a9efcc52662596ef4ca8` and `0eb83c8fac26426a04425ba26e3d9d37d28c77c3`; copy conventions intentionally, not PostgreSQL semantics.
- Existing validation primitive: framework `validateCodecTypeParams`.
- Rules: `.agents/skills/no-bare-casts/SKILL.md`, `.agents/rules/no-transient-project-ids-in-code.mdc`, `.agents/rules/no-target-branches.mdc`.
- Harness constraint: built-in search/grep/glob/find-path tools are forbidden. Use bounded terminal/bash `rg` for all discovery and `sed`/`cat` only for targeted reads.

## Operational metadata

- **Model tier:** persistent implementer/thorough — public generic typing and structural validation require judgment despite D1 precedent.
- **Time-box:** 60 minutes wall clock. Context/tool ceilings return a precise handoff rather than widening scope.
- **Halt conditions:** generic framework refactor required; `many` cannot be rejected without public semantic ambiguity; production renderer/codec JSON behavior changes; fixtures/contracts drift; unrelated gate red; any destructive Git or `git stash*` action. Preserve the repository-global prototype stash.
