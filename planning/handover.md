# Handover: Prisma 8 GA planning

Written 2026-10-20 by brigid-15. It replaces any earlier handover. Read it, then [for-agents.md](for-agents.md), then [plan.md](plan.md).

## What this work is

Will Madden runs the plan for shipping Prisma 8 GA. The target is the end of October 2026, with November as the fallback. The team is Will and Serhii, and agents write the code. This session does not build features. It keeps the plan true and answers Will's questions about it.

The plan lives in `planning/` on the branch `planning/prisma-8-ga` in prisma/orm. Push to it through the `bot` remote. Never open a PR from it and never merge it into `main`.

The typical requests from Will, and what each one means:

- **"refresh the plan"**: check every row against GitHub (prisma/orm, prisma/composer, prisma/prisma-cli, and prisma/web for docs) and Linear. Update plan.md and evidence.md, recount the readiness table, commit and push.
- **"what's the next highest priority for me"**: name the top unstarted Must row in Will's streams (1, 2 and 5, plus his named exceptions). Never name in-flight work or reviews. Check all three repos before calling a row unstarted.
- **A decision or a note from Will or Serhii**: write it into decisions.md, and change plan.md if the order or a row changes. Then commit and push in the same turn.
- **A presentation or summary for the team**: see "Team deck" below.

## State on 2026-10-20

GA readiness is 15 of 36 Must projects done (42%). 13 are in progress and 8 are not started. Since 2026-10-16, Will's rule is that **a project that has started is Must**, whatever it was placed as before.

| Stream | Done |
| --- | --- |
| 1 Foundations and breaking changes | 3 of 8 |
| 2 Upgrade path from Prisma 7 | 1 of 7 |
| 3 Editor and tools | 2 of 5 |
| 4 Query features | 8 of 11 |
| 5 Docs and the new user's first hour | 1 of 5 |

Last refresh: 2026-10-20 afternoon, by icarus-42. Open at that time: prisma/orm#30535 (file watching) and prisma/orm#30495 (skill data transforms), both approved and not merged. In review: prisma/orm#30774 (Prisma 7 planner gaps), prisma/orm#30789 (client surfaces slice 3), prisma/orm#30788 (Prisma 7 `Unsupported` reader), prisma/orm#30790 (enum members, part of TML-3389) and prisma/orm#30734 (nested writes, Serhii). Check them all first.

The next unstarted row for Will is the **early MySQL attempt** (stream 1, row 3). No PR, ticket or recent branch exists for it; the only MySQL branches are Prisma 7 adapter work from June 2025. After it come stream 2's upgrade guide rewrite (TML-3540), the codecs (TML-3270) and the enum membership check on adoption.

Open item: stream 1 row 9, removing the `unbound` / `__unbound__` namespace alias, is Serhii's proposal (prisma/orm#30751, approved, not merged) and is "Not decided". Raise it with Will only if he asks about stream 1.

## Mistakes made in this work, and the rule each one taught

1. **A push failed silently.** `git push … 2>/dev/null` hid a rejection, and the report claimed a commit was pushed. Other sessions push to this branch too. Always: `git fetch bot planning/prisma-8-ga`, merge with `git merge` (never rebase), push, then confirm with `git ls-remote bot refs/heads/planning/prisma-8-ga` that it equals `git rev-parse HEAD`.
2. **A PR's state went stale.** A PR merged between the check and the report. Re-read the state of every PR you list right before you report.
3. **"Not started" was wrong.** Emulator controls and the several-`types`-blocks feature were already in progress or already worked. Search open and merged PRs in all three repos, and the code itself, before calling anything not started or missing. Prefer reading tests and behavior over type definitions.
4. **Merging a PR closes the ticket in its title.** TML-3585 and TML-3607 were closed when their ADR PRs merged. Check the ticket state against the code, reopen it, and add a short comment.
5. **"Steven" is Serhii.** `StevenMcClankerton` is Serhii's bot account, and `wmadden-electric` is Will's. Credit Serhii for StevenMcClankerton PRs. An approval from `SevInf` on one of them is Serhii approving his own work.
6. **The previous state is not the current state.** "This was not designed" (meaning the old plan said so) read as a false claim. State only the current fact.
7. **Will reads progress as counts.** He rejected rows of emoji. Show "N of M (P%)" against a known total.

## Team deck

On 2026-10-16 Will asked for a presentation of the last two weeks for the team. It is published at https://claude.ai/artifact/WPWi6ksfoLrmUGRSoMv8ST (private; Will shares it). Its source is [presentations/2026-10-16-progress.html](presentations/2026-10-16-progress.html). To update the published version, read the artifact by its URL with the Artifact tool, then publish to the same `url`. Its figures date from 2026-10-16 (12 of 34) and are now out of date.

## Where the context is

- This session's transcript (brigid-15, 2026-10-16 to 2026-10-20): `~/.claude/projects/-Users-wmadden-Projects-prisma-orm--claude-worktrees-prisma-8-ga-planning-6cd801/e10720d1-c3ac-432b-9fd4-f391bc90df69.jsonl`
- The previous session (cicero-33, 2026-10-08 to 2026-10-15): `~/.claude/projects/-Users-wmadden-Projects-prisma-orm--claude-worktrees-prisma-8-ga-planning-cf06e4/e9357a1d-0f66-4681-a592-e3af8f7d3770.jsonl`
- The transcripts are JSON lines. To read the conversation, keep the `user` and `assistant` entries and their `text` parts.
- Will's memory notes for each in-flight project are in `~/.claude/projects/-Users-wmadden-Projects-prisma-orm/memory/` (index: `MEMORY.md`). They name the session that owns each project and its open PRs. They are often fresher than Linear.

## How to start

1. Name yourself, as `~/.claude/CLAUDE.md` says.
2. In your worktree: `git fetch bot planning/prisma-8-ga && git worktree add wip/planning -b <name>/planning FETCH_HEAD`. `wip/` is gitignored.
3. Read this file, for-agents.md, plan.md and decisions.md.
4. Tell Will you are ready, and wait for his request. Don't refresh unasked.
