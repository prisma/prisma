# Brief: D7 Round 2 — independently execute prose upgrade entries

## Task

Validate the two prose-only `runtime-query-execute-hard-cut` entries by independently applying them to pre-PR user and extension substrates, without consulting or applying the branch's expected substrate patch until the candidate migration is complete, then compare the independently produced state to the branch and run the corresponding suites.

## Scope

**In:** A fresh isolated worktree/temporary copy. Read the two committed instruction entries, replace only `examples/` and `packages/3-extensions/` in the isolated environment with their current `origin/main` state, discover candidates from the entry detection/guidance, classify each call by result semantics, and edit the isolated substrate as a downstream applying agent would. Temporary private scripts are allowed only after per-site semantic classification; do not publish a global codemod. Record a pre-comparison manifest of edited/candidate files. Only after the candidate migration is frozen may the validator inspect `git diff origin/main...<topic> -- examples/ packages/3-extensions/` and compare states.

**Out:** Editing the primary worktree; changing committed instructions or implementation; using the expected topic-branch patch as the migration mechanism; copying topic-branch substrate files; weakening comparison to filenames only; pushing.

## Completed when

- [ ] Pre-comparison evidence shows candidate discovery, semantic classification, and independently authored edits based only on the two entries.
- [ ] Exact comparison after unblinding reports either byte-identical user/extension substrate states or concrete mismatches attributable to incomplete/incorrect instructions.
- [ ] `pnpm test:examples` and `pnpm test --filter='./packages/3-extensions/*'` run against the independently migrated isolated state; unavailable external environment is reported exactly, not marked green.
- [ ] Primary worktree tracked/index state remains clean and no commit is created for validation-only temporary work.

## Operational metadata

- **Model tier:** orchestrator — blindness and semantic classification are the evidence.
- **Time-box:** 120 minutes.
- **Halt conditions:** The validator consulted the expected patch before freezing its candidate state; instructions are insufficient to classify a site; replay would require a public decision; primary worktree is modified.
