# Brief: D2 align durable architecture and migration guidance

## Task

Align every live architectural and migration-guidance surface with Dispatch 1's hard cut. Author accepted ADR 241 for the unified type-contribution channel, amend ADR 231's active `@db.*` carve-out, and update current ADR prose, subsystem guidance, current upgrade instructions, and active agent skills so bare type-position constructors are the only supported storage-type authoring surface.

## Scope

**In:** New ADR 241; ADR 231; the live examples/prose in ADR 226 and ADR 239's “Option arguments and select templates…” section; `docs/architecture docs/subsystems/6. Ecosystem Extensions & Packs.md`; the current `prisma-next-contract` and `prisma-next-supabase` skills at their tracked canonical paths; both current `0.16-to-0.17` upgrade instruction files; verification that `packages/2-sql/5-runtime/src/sql-context.ts` needs no edit because it contains no stale `@db` wording.

**Out:** Production code/tests from D1; old release-specific upgrade records; historical ADR context outside the explicitly live/current passages; release notes; indiscriminate repository-wide rewriting; no-op edits; unrelated skill or documentation cleanup.

## Completed when

- [ ] Accepted ADR 241 records that scalar types are zero-argument type constructors contributed through `AuthoringContributions.type`, while parameterized storage types use the same constructor channel, with context, rationale, consequences, alternatives, and links consistent with sibling ADRs.
- [ ] ADR 231 removes the active `@db.*` named-type attribute carve-out without rewriting unrelated historical reasoning.
- [ ] ADR 226, ADR 239's live option/select prose, the ecosystem extensions subsystem, both active agent skills, and both current `0.16-to-0.17` upgrade files use or teach bare type-position constructors and explain that `@db.X(args)` is removed with the actionable `X(args)` rewrite.
- [ ] Every touched Markdown file follows local structure, frontmatter, links, and one-line prose paragraph conventions; tracked canonical skill files—not presentation-only symlinks or unrelated untracked skills—carry the edits.

## Standing instruction

Stay focused on the goal; control scope. Trivial-and-related fixes that obviously serve the goal go in the same dispatch with a one-line note in your wrap-up message. Anything that pulls you off the goal — even if it looks useful — halts and surfaces.

## References

- Slice spec: `projects/remove-db-attributes/slices/remove-db-channel/spec.md` — documentation decisions and historical exemptions.
- Slice plan entry: `projects/remove-db-attributes/slices/remove-db-channel/plan.md` § Dispatch 2.
- Dispatch 1 implementation: commit `dff7cb15c60a520179b86b2f0055da6c53e81718` — exact user-facing diagnostics now enforced.
- Required techniques: `write-architecture-docs`, `markdown-no-artificial-line-wraps`, and the repository's ADR conventions. Use `ignite-create-adr` only as general narrative guidance where it agrees with this repository's existing ADR path/template; sibling ADRs and project rules are authoritative.
- Project rule: agent skills are edited at tracked canonical paths. If `skills/...` is a presentation symlink, stage the corresponding canonical `skills-contrib/...` path.

## Validation gates

- `pnpm lint:skills`
- `git diff --check`
- Fixed-string inventories over the explicitly in-scope current ADR, subsystem, skill, and `0.16-to-0.17` upgrade files proving no live example still recommends `@db.*`; retained mentions must be migration text.
- Confirm `packages/2-sql/5-runtime/src/sql-context.ts` contains no `@db` wording and leave it untouched.

## Operational metadata

- **Model tier:** `implementer/fast` (`mid`) — bounded documentation surgery with decisions fully pinned by the slice spec.
- **Time-box:** 45 minutes. Overrun halts and surfaces rather than widening the historical scrub.
- **Halt conditions:** ADR 241 already exists or the next accepted ADR number is not 241; a required current upgrade file or active skill cannot be identified; a canonical skill path is ambiguous; a live passage contradicts the pinned design; an out-of-scope historical record would need rewriting; or a slice assumption is false.

## Constraints

- Read at least two sibling architecture documents and the ADRs being referenced before authoring ADR 241.
- Keep prose paragraphs on single source lines; do not hard-wrap Markdown.
- Explicit staging only; no amend; no push.
- Prefer one coherent documentation commit.
- No side quests and no implementation edits.
- Do not edit project spec, plan, trace, or review artifacts.
- Do not stage or modify unrelated untracked `agent/` or `skills/*` paths.