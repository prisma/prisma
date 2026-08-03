# Upgrade-instructions scan brief

**Branch:** `tml-2526-facades-must-re-export-everything-users-import-in-their-app`
**Worktree:** `tml-2526-facades-must-re-export-everything-users-import-in-their-app`

## Goal

Confirm whether our branch's 51 commits touched any `prisma-8-extension-upgrade/upgrades/<version>/` artefacts or other upgrade-instruction surfaces. PR #565 (`release/0.11.0`) will land soon and references `upgrades/0.10-to-0.11/` for the TML-2614 Mongo ownership change. If our branch also added upgrade-instruction artefacts (for a different version target), they may need to migrate when 565's bump lands.

The orchestrator's working assumption (unverified) is: the slice is purely additive (new facade subpaths + `defineContract` wraps + docs prose flips), so no upgrade instructions were added. This dispatch verifies that assumption.

## Read-only investigation

1. Compute the merge-base: `git merge-base origin/main HEAD`. Record the sha.
2. List every file changed by our branch under upgrade-instruction-relevant paths:
   ```
   git diff --name-only $(git merge-base origin/main HEAD)..HEAD -- \
     'prisma-8-extension-upgrade' \
     '**/upgrades/' \
     '**/upgrade-*.md' \
     '**/UPGRADE.md'
   ```
3. For each match: classify as `added` / `modified` / `deleted` (use `git log --name-status` on the file across our 51 commits) and record the version folder it lives in if any (e.g. `upgrades/0.10-to-0.11/`).
4. Also scan our project-side artefacts at `projects/facade-import-surface-completion/**` for any references to upgrade instructions, version migration, or `prisma-8-extension-upgrade` (in spec.md, plan.md, slice/spec.md, etc.). Use `rg`.
5. Also scan all changed files for the strings `upgrade-instructions`, `0.10-to-`, `recordUpgrade`, `record-upgrade` across the diff body:
   ```
   git diff $(git merge-base origin/main HEAD)..HEAD | rg -i 'upgrade-instructions|0\.10-to-|recordUpgrade|record-upgrade'
   ```

## Hard rules

- Read-only. No commits, no source modifications, no GitHub posts.
- Heartbeat to `wip/heartbeats/upgrade-scan.txt` at start, mid-investigation, and end (3 heartbeats minimum).
- `git status` must show clean working tree at end (only heartbeat file modified).

## Structured report

```
## Status
COMPLETE

## Merge-base sha
<sha>

## Upgrade-instruction files touched by our branch
- <list with classification (added/modified/deleted) + version folder>
  - OR "none — our branch made no changes under prisma-8-extension-upgrade/ or any **/upgrades/ path"

## Project-side references to upgrade instructions
- <list of files/lines under projects/facade-import-surface-completion/ mentioning upgrade-related concepts>
  - OR "none"

## Diff-body string scan results
- <one line per hit, or "no hits">

## Recommendation for PR description
- Suggested wording for PR #557's `## Reviewer notes` or `## Follow-ups` section:
  "<one-line statement, e.g. 'No upgrade instructions added; nothing to migrate when PR #565 lands the 0.11.0 bump.'>"
- OR (if files found): "<one-line statement noting what was added and what's required for the 565 migration>"

## Surfaced for orchestrator attention
- <anything>
```
