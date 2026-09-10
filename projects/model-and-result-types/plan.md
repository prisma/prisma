# Model and result types — Plan

**Spec:** `./spec.md` · **Brief:** `./design-brief.md` · **Linear:** [project](https://linear.app/prisma-company/project/model-and-result-types-080d7caa544f)

## Composition (1 slice, 1 PR)

The operator asked for all work on one PR and no PR under 1,000 lines. The fixture regeneration alone exceeds that, and the pieces share one review story, so this is one slice delivered in three sequential dispatches on this worktree's branch.

### Slice: `models-scalars-with-resulttype`

**Dispatch 1: framework types and emitter.**
`RelationKeys`, `Scalars`, `With` in `framework-components` with re-exports from both family contract packages. The `Models` block and `models` constant in `generate-contract-dts.ts`, with the relation cardinality and nullability computed from contract JSON, polymorphism, Mongo embeds, and collision errors. Family hooks import `RelationKeys`. Emitter snapshot tests per spec. Ends with `pnpm build` at the root green and the emitter package tests green.

**Dispatch 2: ORM phantoms, fixtures, type tests.**
`_row` on both collections. Regenerate every fixture with `pnpm fixtures:check`. Write and pass the SQL ORM, Mongo ORM, and demo type tests per spec. Ends with `pnpm test:packages`, `pnpm fixtures:check`, and `pnpm lint:deps` green.

**Dispatch 3: docs and ADR.**
Reference page, index and README links, subsystem paragraph, ADR 250. Snippets copied from the passing type tests. Ends with `pnpm lint` in the touched packages green.

**Review:** one reviewer pass over the whole diff after dispatch 3, then rework, then PR via `create-pr`.

## Close-out

- [ ] Verify project DoD in `./spec.md`.
- [ ] Docs and ADR live in `docs/` (delivered by dispatch 3).
- [ ] Delete `projects/model-and-result-types/` and strip references.
