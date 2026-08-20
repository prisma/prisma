# Slice close — aggregate-row-scope

Walked 2026-08-18, against the slice spec's `## Slice-specific done conditions` verbatim plus the team floor in `drive/calibration/dod.md § Slice-DoD overlay`. Per that overlay's slice-close ritual: a `READY FOR PR` / `SATISFIED` reviewer verdict covers reviewer-scope items only — it does **not** cover manual-QA, the `projects/`-reference scrub, or any other team overlay item. Treating the reviewer's verdict as proxy for DoD satisfaction is a named orchestrator failure mode in this codebase; this walk is the calibration that prevents it.

Head at walk time: merge commit `0c2eb1cd5a` (`origin/main` synced, 12 commits), 17 slice commits, 21 files touched.

## Slice-specific done conditions

| # | Condition | Verdict | Evidence |
| - | --------- | ------- | -------- |
| 1 | The characterization snapshot was generated on pre-change code and committed before any behaviour dispatch; its file is byte-unchanged at slice close. | ✓ | `07b691a714` touches zero paths under `src/` (`git show --stat`), and it is the first slice commit. Snapshot byte-unchanged across all 17 commits *and* across the `origin/main` merge — verified independently at every review round and once more against `0c2eb1cd5a`'s first parent. |
| 2 | The two root-position tests in `test/aggregate-pagination.test.ts` no longer use `it.fails` and assert the derived-table shape; the grouped test stays `it.fails` for slice 2. | ✓ | `225560d46d`. Suite reports exactly 1 expected fail throughout, which is the grouped case. |
| 3 | Integration tests assert **values**, not just SQL shape, on both PGlite and SQLite for the root position. | ✓ | `27eb89b5aa` and `473eb7bfe9`. Six PGlite cases, five SQLite. Seeds chosen so paginated and unpaginated answers differ, so each case discriminates. |
| 4 | `skip` without a paired `take` is exercised and emits `OFFSET` with no `LIMIT`. | ✓ | Unit-level in `225560d46d`. On SQLite this initially failed — the predicted `near "OFFSET": syntax error` — and now returns an asserted value after `810146cadc`. |

## Team floor — plan-side

| Item | Verdict | Evidence |
| ---- | ------- | -------- |
| Slice touches `packages/3-*-extensions/**` → plan includes a `fixtures:check` step | ✓ | Named in every dispatch's gate set; green against the merged base. |
| Slice touches package boundaries / imports → plan includes `lint:deps` | ✓ | Run at D2, D4b and slice close; green. Caught nothing, but F6 (a coupling the linter permits) came from review instead. |
| Typed surfaces consumed elsewhere → downstream typecheck after the producing package builds | ✓ | Workspace-wide `pnpm typecheck` green against the merged base. D4c ran it as a named gate specifically because the capability gate could break consumers outside this package. |

## Team floor — PR-side

| Item | Verdict | Evidence |
| ---- | ------- | -------- |
| Linear issue moved to `Ready to be merged` | **N/A** | This project runs tracker-free by operator decision (2026-08-17); each slice is tracked by its PR. |
| PR title carries a Linear ticket prefix | **N/A** | Same. |
| PR description follows `drive-pr-description` shape | ⏳ | Pending — the next step after this walk. |
| PR linked to its Linear issue | **N/A** | Same. |
| No `projects/` references in long-lived files added by the slice | ✓ | Verified twice independently: the implementer's two-pass sweep over `git diff origin/main...HEAD`, and my own grep over every non-`projects/` file in the slice diff. Both empty. Also zero transient identifiers (`D<n>`, `F<n>`, `AC-<n>`, `TC-<n>`, `CKPT-<n>`) — F12 existed because that scan lapsed once, and the sweep it triggered covered all 17 commits. |

## Team floor — QA-side

| Item | Verdict | Evidence |
| ---- | ------- | -------- |
| A `drive-qa-plan` script exists and ≥1 `drive-qa-run` report exists | ✓ | `manual-qa.md`; report at `manual-qa-reports/2026-08-18-qa-runner.md`. |
| No unresolved 🛑 Blocker findings | ✓ | Five findings, none blocking. One fixed in-PR (F13), one closed as already-adjudicated by the project spec's non-goals, three routed to follow-ups. |
| Script names **both** consumer audiences, or states single-audience explicitly | ✓ *(gap found and fixed during this walk)* | The script exercised both but named neither. Amended during the walk to name end users (scenarios 1, 2, 6 via `examples/prisma-8-demo`) and extension authors (scenarios 3, 5 via `defineContract` and the exported `Collection` surface). **This is the item the walk existed to catch** — every reviewer verdict was `SATISFIED` and none of them could see it. |

## Team floor — pre-push

| Item | Verdict | Evidence |
| ---- | ------- | -------- |
| Sync `origin/main`, then re-run the always-run gates before opening the PR | ✓ | Merge `0c2eb1cd5a`, clean, no conflicts. Eight gates re-run individually against the merged base, each green. Baseline snapshot unmoved across the merge. |

## Project-DoD items this slice closes

Recorded here so the project close-out can check them off rather than re-derive them:

- Root `.aggregate()` honours `take` / `skip` / `cursor`, including `skip` without `take` — ✓
- Root `.aggregate()` honours `distinct()` / `distinctOn()` via the existing `ROW_NUMBER` lowering — ✓ (with `distinctOn` now capability-gated, which the project DoD did not anticipate)
- A CI-enforced guard proves an unpaginated aggregate's compiled AST is unchanged — ✓
- Integration tests assert values on both PGlite and SQLite for the root chain position — ✓ (grouped positions remain for slice 2)
- No new ORM error subcode was added — ✓ (`ORM.CAPABILITY_MISSING` reused)

Still open for slice 2: pre-group and post-group pagination semantics, the `orderBy`-required gate on grouped pagination, removal of the last `it.fails`, and the `groupBy` half of the position-semantics documentation.

## Verdict

**Slice DoD met.** One gap found during the walk (consumer audiences unnamed) and closed during it. Ready for the PR.
