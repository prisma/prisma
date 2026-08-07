# Brief: record the runtime hard-cut upgrade instructions

## Task

Record the actionable 0.17 → 0.18 source translation for both Prisma Next users and extension authors, so downstream agents can migrate row execution to `query` / `queryPrepared`, reserve `execute` for statement statistics, adapt middleware/fakes, and replace the removed Mongo facade row executor without compatibility shims or unsafe global replacement.

## Scope

**In:** Append a unique `runtime-query-execute-hard-cut` change and matching prose to:

- `skills/prisma-next-upgrade/upgrades/0.17-to-0.18/instructions.md`
- `skills/prisma-8-extension-upgrade/upgrades/0.17-to-0.18/instructions.md`

User guidance covers public runtime calls, prepared rows, statistics results, and the Mongo facade collision (`db.query` remains the builder; execute built plans through `(await db.runtime()).query(plan)`). Extension guidance additionally covers `RuntimeExecutor`/scope implementations, operation-discriminated middleware intercept/completion results, and distinct row/statistics fakes. Detection should find likely retired calls while telling the applying agent to classify by consumed result; prose-only is preferred over an unsound global codemod.

**Out:** Rewriting prior 0.17 → 0.18 entries; compatibility aliases; API changes; count-semantics documentation owned by TML-3169; claiming all `execute` calls are rows; editing examples/extensions beyond validation.

## Completed when

- [ ] Both instruction files contain one actionable, audience-specific entry with no duplicated no-op narrative and no artificial line wraps.
- [ ] Validation against the pre-PR `examples/` and `packages/3-extensions/` substrates demonstrates that following each entry yields the corresponding branch state, using isolated/non-destructive validation.
- [ ] `pnpm check:upgrade-coverage`, skill lint/format checks, and relevant instruction validation pass; tracked/index state is clean after an explicit signed commit.
- [ ] The final PR body names both upgrade entry directories and describes this as a public hard-cut migration.

## Operational metadata

- **Model tier:** mid — two audiences, settled translation, semantic classification required.
- **Time-box:** 75 minutes.
- **Halt conditions:** A deterministic script would need to guess operation semantics; the branch substrate includes an unrelated translation that cannot be described by this entry; validation requires destructive changes to the primary worktree; a new public API decision appears.
