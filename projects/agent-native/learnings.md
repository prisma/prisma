# Learnings — agent-native

Working ledger of patterns surfaced during this run. Reviewed at close-out; cross-cutting
lessons migrate to durable docs, project-local ones drop with the project folder.

- **2026-07-03 (D1):** A fresh git worktree of this monorepo cannot typecheck `packages/cli`
  until workspace dependencies are built — run `pnpm install` then
  `pnpm exec turbo build --filter='prisma^...'` (~4 min) before any `tsc` gate. Dispatch
  time-boxes for fresh worktrees must budget for this; resumed dispatches in the same
  worktree inherit the built state. Candidate for `drive/plan/README.md` (validation-gate
  overlay) at close-out.
- **2026-07-03 (D1):** The upstream `skills` CLI is `skills` on npm (vercel-labs/skills),
  v1.5.14 at pin time — the version literal lives in
  `packages/cli/src/init/skill-install.ts` as `SKILLS_CLI_VERSION`.
