# Learnings — aggregate-pagination

Carried into the mandatory final retro. Each entry names the surface that should absorb it.

## 1. `check:upgrade-coverage`'s `per-pr-declaration` rule is mechanical, not semantic

It does not ask whether the diff is *covered* by existing instructions. It checks `changedPaths.has(instructionsPath)` — whether this PR's own diff touches `instructions.md` at all. A file that already exists with valid, parsing entries does not satisfy it. Every PR touching the substrate must re-touch the file.

Cost so far: a red CI run on slice 1, and a dedicated dispatch on slice 2 to pre-empt the repeat. Both times the diagnosis required reading `scripts/check-upgrade-coverage.mjs` rather than the skill doc, because the doc describes the intent and the code implements something stricter.

There are also **two** upgrade skills — `skills/prisma-next-upgrade/` and `skills/prisma-8-extension-upgrade/` — and the gate names the second. The orchestrator's brief for the pre-empting dispatch pointed at the first; the implementer ignored the hint and followed the gate's own error text, which was correct.

**Landing surface:** a rulecard, or a line in the upgrade skill's own doc, saying the rule is "touch the file" rather than "cover the change", and naming which of the two skills the gate reads.

## 2. Build before typechecking after any base change

Six separate interruptions across this project were the same class: a workspace-subpath `TS2307` (or a downstream `TS7006` once types were unresolvable), fixed by `pnpm build` populating `dist/`, never by `pnpm install`. The final instance cost a dispatch's worth of investigation and a false "workspace typecheck is red" report that briefly looked like a merge blocker.

The tell is a `TS2307` naming a workspace package subpath. The distinguishing test is whether the producing package's `dist/` exists — `pnpm install` does not create it.

**Landing surface:** the team's DoD validation gates already list `pnpm typecheck`; they should say to build first after a base change. `workspace-package-not-found-run-pnpm-install.mdc` covers the missing-module case but is keyed to install, not build.

## 3. Verify a scope justification before handing it down as fact

The orchestrator justified pulling the MTI variant-join fix into slice 2 by asserting the grouped path previously carried its joins in the outer query, so the derived-table wrap must have dropped them — making it a regression this slice caused. The implementer checked git history instead of building on it and found `compileGroupedAggregate` never resolved polymorphism info at any commit. Pre-existing gap, not a regression.

The fix was still worth including, but on different grounds. Had the implementer accepted the framing, the PR would have described a pre-existing bug as a self-inflicted one, and the retro would have drawn the wrong lesson about derived-table wraps.

**Landing surface:** already covered in spirit by the reviewer/implementer contract, but worth stating: a brief's *rationale* is as checkable as its instructions, and an executor pushing back on it is doing the job.

## 4. Timestamps beat inference when a subagent looks unresponsive

Idle notifications repeatedly arrived between a dispatch being sent and the agent picking it up, making completed work look refused. One round produced a redundant correction message; another nearly produced a double-applied edit, avoided only because the tool required reading the file first.

Checking file mtime against the message timeline resolved every instance in one call.

**Landing surface:** orchestrator guidance — treat an idle notification as unreliable evidence about work state, and verify against disk.
