# Brief: D5 projected codec preservation and slice gate

## Task

Make `ProjectionItem.codec` authoritative projected-result metadata, not direct-column-only metadata. Write a red regression around `wrapWithRowNumberDedup` using a complete parameterized-and-`many` `CodecRef`, fix derived-table forwarding so the exact codec metadata survives, audit every SQL ORM projection reconstruction for the same invariant, document the broadened meaning at the owning type, and prove the completed slice with the full final gate.

## Scope

**In:** Tests first; `ProjectionItem.codec` semantic documentation at its owning type; SQL ORM projection-wrapper/reconstruction audit using bounded `rg`; the known `wrapWithRowNumberDedup` preservation fix; concise regression coverage that cannot pass with shallow/partial metadata; touched production cast conversion per policy; final package/downstream/workspace gates; forbidden-scope and transient-ID sweeps.

**Out:** New codec shapes or IDs; target descriptor/registry/lookup behavior; executable `CodecJsonValueProjection`; canonical codec JSON behavior; PostgreSQL/SQLite scalar or array transforms; array-lift construction; aggregate descriptors or `aggregateTypes`; fixtures/contracts/upgrade instructions; public testkits; prototype implementation; unrelated cleanup; project artifact edits.

## Completed when

- [ ] A focused SQL ORM test is observed red before implementation and green afterward while asserting complete preservation of a parameterized-and-`many` codec through `wrapWithRowNumberDedup`.
- [ ] Every SQL ORM projection reconstruction is enumerated with bounded `rg`, audited, and either preserves the complete `ProjectionItem.codec` or is explicitly shown not to reconstruct projected values; any required in-scope fix has regression coverage.
- [ ] The owning `ProjectionItem.codec` declaration documents it as metadata for any known projected result, without changing the codec representation.
- [ ] The full final slice gate passes: relational-core build/test/typecheck/lint; PostgreSQL adapter test/typecheck/lint; SQLite adapter test/typecheck/lint; SQL ORM test/typecheck/lint; `pnpm lint:casts`; `pnpm lint:deps`; workspace `pnpm typecheck`; and `pnpm test:packages`.
- [ ] Closing sweeps find no later-slice target descriptor/codec behavior, aggregate/fixture/contract/prototype work, transient project ID, or new bare production cast; `git diff --check` is clean.
- [ ] Changes are explicitly staged and committed with sign-off; do not amend or push. The tracked worktree is clean and the final report includes commit SHA, changed files, audit evidence, every gate result, and any deferral.

## Standing instruction

Stay focused on projected-result codec preservation and final proof. Preserve codec metadata as one complete value rather than reconstructing selected fields. An unexpected serialized fixture/contract drift, a wrapper requiring new semantics, or a gate failure whose cause is unclear is a halt—not permission to regenerate, redesign, or absorb later-slice work.

## References

- Slice spec: `projects/codec-json-projections/slices/01-sql-json-projection-ast-foundations/spec.md` §§ Authoritative `ProjectionItem.codec`, Slice-specific done conditions, Scope.
- Slice plan: `projects/codec-json-projections/slices/01-sql-json-projection-ast-foundations/plan.md` § Dispatch 5 and Final slice gate.
- Review scoreboard: `projects/codec-json-projections/reviews/code-review.md`; D1–D4 are reviewer-SATISFIED, with AC-1 and AC-2 PASS and no open findings.
- Known production surface: `packages/3-extensions/sql-orm-client/src/query-plan-select.ts` (`wrapWithRowNumberDedup`); enumerate all other reconstruction sites rather than assuming this is the only one.
- Rules: `.agents/skills/no-bare-casts/SKILL.md`, `.agents/rules/no-transient-project-ids-in-code.mdc`.
- Stable prior head: D4 R2 implementation `64b05cd8b6117943365c11459345fd8b8bfb0541`; D4 trace close `fa6563f8ea`.

## Operational metadata

- **Model tier:** persistent implementer/thorough — preservation audit and workspace-wide proof require judgment and continuity.
- **Time-box:** 90 minutes wall clock. Use the full gate as written; overrun or a hanging command is reported precisely rather than silently skipped.
- **Halt conditions:** the codec representation itself must change; target-specific behavior is needed; a new projection kind or wrapper semantic is required; fixtures/contracts drift; prototype hunks are implicated; an out-of-scope surface must change; a named assumption is false; a final gate is red for an unclear or unrelated reason; any destructive Git or `git stash*` action. Preserve the repository-global prototype stash.
