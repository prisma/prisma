# OSS Setup — Plan

## Summary

Open Prisma Next to external contributions by closing the legal, operational, supply-chain, and discovery gaps that make external participation unsafe today. Three deployable milestones land the work in order: publish-hygiene + NOTICE audit (correctness, ships independently), disclosure & supply-chain & reviewer infrastructure (additive, ships independently), and the posture flip itself — DCO enforcement, contributor docs, templates, label taxonomy, and the `contrib-pr` agent skill — which is the "open the doors" milestone.

**Spec:** `projects/oss-setup/spec.md`

## Collaborators

| Role         | Person/Team                                    | Context                                                                    |
| ------------ | ---------------------------------------------- | -------------------------------------------------------------------------- |
| Maker        | William Madden                                 | Drives execution end-to-end                                                |
| Reviewer     | `@prisma/ORM-TS-Maintain`                      | Public-facing maintainers-of-record; reviews the project PRs               |
| Approver     | Prisma Next leadership (Slack thread)          | Confirms no relicensing optionality required (DCO vs CLA gate)             |
| Collaborator | Whoever owns Prisma's GitHub org settings      | DCO App install, PVR enable, branch-protection updates, "first-time approval" toggle, label provisioning |
| Collaborator | Whoever provisions Prisma email aliases        | Standing up `conduct@prisma.io` (or confirming fallback)                   |

## Shipping Strategy

Every milestone is independently safe to deploy to `main`:

- **M1 (publish hygiene + audit)** is purely additive: it adds `"license"` fields to package manifests, adds two scripts, and wires one of them into the existing `lint` CI job. The validator only fires on packages it inspects, so it cannot regress unrelated CI. The NOTICE script is run-on-demand; whether or not a `NOTICE` file lands at the root depends on the audit result.
- **M2 (disclosure + supply-chain + reviewer infrastructure)** is repository-config + new files + repository-settings toggles: enabling Private Vulnerability Reporting, adding `SECURITY.md`, `.github/CODEOWNERS`, `.github/dependabot.yml`, the CoC enforcement contact, the auto-Release notes addition to `publish.yml`, the *Require approval for first-time contributors* toggle, and the branch-protection update (≥1 CODEOWNER review required). None of these change the public-facing posture from "no PRs" — they are the infrastructure that *enables* M3 to flip the switch safely. The CODEOWNERS rule starts auto-requesting review (advisory, then enforcing once branch protection is set in the same task).
- **M3 (posture flip)** is the only milestone that changes externally-visible posture. It does the coupled changes that must ship together: (a) turn on DCO as a required PR check, (b) replace `CONTRIBUTORS.md`'s closed-doors content with `CONTRIBUTING.md`'s open-doors content (self-contained setup, governance hint, link to `contrib-pr` skill), (c) update README with Contributing section + stability statement + badges, (d) add PR/issue templates with the security `contact_link`, (e) configure the label taxonomy and curate `good first issue` items, (f) ship the `contrib-pr` skill, (g) delete `CONTRIBUTORS.md`. Splitting these creates intermediate states that are confusing to outside observers (DCO required but no docs on how to sign off; or open-doors docs without enforcement). They land in one PR.

Implicit gates between old and new behaviour:

- Between M1 and M2: none — both purely additive.
- Between M2 and M3: the absence of `CONTRIBUTING.md` and the presence of the closed `CONTRIBUTORS.md` is the gate. Until M3 ships, the public-facing posture remains "no PRs". M2's infrastructure (CODEOWNERS, branch protection, SECURITY.md, Dependabot, auto-Releases, fork-PR approval toggle) does no harm in the closed state — Dependabot's PRs are internal-actor PRs that maintainers review normally; the auto-Releases addition only fires on `main` push (existing publish trigger).
- During M3: the DCO required-check is enabled simultaneously with the doc replacement, so any external contributor reading the new `CONTRIBUTING.md` finds it consistent with what the merge gate enforces. In-flight maintainer PRs at the moment of switchover may need a one-time `git rebase --signoff`; this is documented in the M3 PR description and is a one-time cost.

No feature flags are required.

## Test Design

| AC    | TC     | Test Case                                                                                                                  | Type                | Milestone | Expected Outcome                                                                                                                                              |
| ----- | ------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1   | TC-1   | Run `pnpm lint:manifests` against the workspace                                                                            | Integration (CI)    | M1        | Exits 0 after license fields are added; stdout reports success across all enumerated publishable packages                                                     |
| AC2   | TC-2   | Strip `"license"` from one publishable package fixture and invoke the validator                                            | Unit                | M1        | Exits non-zero with the offending package path named in the error report                                                                                      |
| AC3   | TC-3   | Open a draft PR that strips a `"license"` field from any one publishable package                                           | Integration (CI)    | M1        | The `lint` job in `.github/workflows/ci.yml` fails with the manifest validator error                                                                          |
| AC4   | TC-4   | Run `pnpm pack` on at least one publishable package; inspect the tarball's `package/package.json`                          | Manual smoke        | M1        | Tarball contains `"license": "Apache-2.0"`                                                                                                                    |
| AC5   | TC-5   | Execute `node scripts/audit-notice.mjs` against the workspace                                                              | Integration         | M1        | Audit runs to completion and prints a report; either a root `NOTICE` is generated **or** `projects/oss-setup/assets/notice-audit.md` records the no-op result |
| AC6   | TC-6   | Open a test PR with one or more commits lacking `Signed-off-by:`; then amend with `--signoff` and force-push               | Manual              | M3        | DCO check fails on the first push, passes after the signed force-push                                                                                         |
| AC7   | TC-7   | `gh api repos/<org>/<repo>/branches/main/protection` (or repo settings UI)                                                  | Manual              | M3        | `DCO` is among the listed required status checks, alongside the existing checks                                                                                |
| AC8   | TC-8   | Visit the repo's *Security* tab on github.com; read `SECURITY.md`                                                          | Manual              | M2        | "Report a vulnerability" is available; `SECURITY.md` declares scope, 5-biz-day SLA, pre-1.0 supported-versions stance                                          |
| AC9   | TC-9   | Read `CODE_OF_CONDUCT.md`                                                                                                  | File content check  | M2        | Enforcement section names a real reporting channel (email alias or private Discord channel), not the placeholder phrasing                                     |
| AC10  | TC-10  | Open a draft PR from a feature branch                                                                                      | Manual smoke        | M2        | `@prisma/ORM-TS-Maintain` is auto-requested as a reviewer; "Review required" merge blocker is present                                                         |
| AC11  | TC-11  | Inspect repo Settings → Actions → General; or open a fork PR from a fresh account                                          | Manual              | M2        | "Require approval for first-time contributors" is enabled; fork-PR workflow runs are gated on a maintainer's approval                                          |
| AC12  | TC-12  | Inspect GitHub's Dependabot tab one week after `.github/dependabot.yml` lands                                              | Manual              | M2        | Configured ecosystems show no errors; at least one Dependabot PR has been opened; PR count conforms to grouping (NFR6)                                        |
| AC13  | TC-13  | After a test publish, inspect the GitHub Releases page; or `gh release view <tag>`                                         | Manual              | M2        | A Release exists for the tag with auto-generated notes referencing merged PRs and links to published npm packages                                              |
| AC14  | TC-14  | Visit `https://github.com/<org>/<repo>/community` (Community Standards check)                                              | Manual              | M3        | All checklist items reported green: README, CoC, Contributing, License, Security, Issue templates, PR template                                                |
| AC15  | TC-15  | On a fresh clone of the public repo, follow only the commands documented in `CONTRIBUTING.md` and run a representative test | Manual              | M3        | The clone-build-run cycle completes without consulting `AGENTS.md` or `docs/onboarding/Getting-Started.md`                                                    |
| AC16  | TC-16  | Verify `CONTRIBUTORS.md` is absent; verify README contains *Contributing* section, pre-1.0 stability statement, and badges  | File content check  | M3        | All three present in README; `CONTRIBUTORS.md` does not exist                                                                                                 |
| AC17  | TC-17  | File a new issue on the repo                                                                                               | Manual              | M3        | Bug-report and feature-request forms appear in the chooser; "blank issue" is disabled; `contact_links` show Discord and a security-issue pointer              |
| AC18  | TC-18  | `gh label list` after M3 ships                                                                                             | Manual              | M3        | All labels from FR19 exist; at least 3 issues are tagged `good first issue`                                                                                   |
| AC19  | TC-19  | Read `.claude/skills/contrib-pr/SKILL.md` and grep for forbidden internal references                                       | File content check  | M3        | Frontmatter has `name`/`description`; no references to Linear, internal Slack channels, internal plan/spec docs, the `walkthrough` skill, or persona-library   |
| —     | TC-20  | (NFR1) Time the validator over the full workspace                                                                          | Integration         | M1        | `time pnpm lint:manifests` reports < 5s on a clean checkout                                                                                                   |
| —     | TC-21  | (NFR5) Smoke-run the `contrib-pr` skill mentally as an external contributor: do all referenced docs/commands exist publicly? | Manual review       | M3        | Every referenced doc/command resolves on a public clone of the repo                                                                                           |
| —     | TC-22  | (NFR7) Time the full publish workflow with auto-Release-notes addition vs without                                          | Manual              | M2        | Wall-clock delta < 30s; otherwise fall back to a separate post-publish workflow per NFR7                                                                      |

## Milestones

### Milestone 1: Publish hygiene + NOTICE audit

**Deliverable.** Every publishable package declares `Apache-2.0`, a CI-enforced validator prevents regression, and the §4(d) NOTICE obligation is resolved (file added or audit recorded).

**Demonstrable end-state.** `pnpm lint:manifests` exits 0 over the full workspace; `pnpm pack` of any sampled publishable package produces a tarball with `"license": "Apache-2.0"`; the lint job in CI invokes the validator; the NOTICE audit has either produced a root `NOTICE` file or a recorded skip rationale.

**Tasks:**

- [x] **1.1** Add `scripts/validate-package-manifests.mjs` modelled on `scripts/validate-rules.mjs` and `scripts/check-publish-deps.mjs`. The validator enumerates publishable packages via the same logic as `scripts/list-publishable-packages.mjs` (or imports it), then for each enforces `package.license === "Apache-2.0"`. Emits a per-package error report on failure. Includes a co-located test file (`scripts/validate-package-manifests.test.mjs`) modelled on `scripts/check-publish-deps.test.mjs` that exercises the negative path. *(satisfies: TC-2, TC-20)*
- [x] **1.2** Add `"license": "Apache-2.0"` to every publishable `package.json` enumerated by `scripts/list-publishable-packages.mjs`. The change is a field addition only — no version bumps, no other manifest edits. Run `pnpm install` afterwards to refresh the lockfile if necessary. *(satisfies: TC-1, TC-4)*
- [x] **1.3** Add a top-level `pnpm` script `"lint:manifests": "node scripts/validate-package-manifests.mjs"` to root `package.json`. Wire `pnpm lint:manifests` into the `lint` job of `.github/workflows/ci.yml` (alongside `pnpm lint:rules`, `pnpm lint:rules:footprint`, `pnpm lint:docs`). *(satisfies: TC-3)*
- [x] **1.4** Add `scripts/audit-notice.mjs`: walks production dependencies of every publishable package (excluding devDependencies), identifies any Apache-2.0-licensed dep that ships a `NOTICE` or `NOTICE.txt` file, and prints a structured report. The script should be pure investigation — it does not mutate the repo. *(satisfies: TC-5)*
- [x] **1.5** Run the NOTICE audit. If §4(d) obligates propagation: generate a root `NOTICE` file aggregating the upstream notices and commit it. Otherwise: write `projects/oss-setup/assets/notice-audit.md` recording (a) what was scanned, (b) which deps had NOTICE files, (c) why none oblige propagation, (d) the date of the audit. *(satisfies: TC-5)*

**M1 outcome:** all five tasks completed locally. Validator passes against all 59 publishable packages (`pnpm lint:manifests` exits 0 in 0.25s — well under the 5s NFR1 budget). 16/16 validator unit tests passing under vitest. NOTICE audit found 1 NOTICE-bearing dep (`bare-path@3.0.0`, Apache-2.0) reachable only via `mongodb-memory-server` as a `devDependency` — **not redistributed** in any published tarball, so §4(d) is not engaged. No root `NOTICE` file added. Audit result recorded at `projects/oss-setup/assets/notice-audit.md`.

**Validation gate:**

- `pnpm lint:manifests` (new — must pass)
- `pnpm lint:rules`
- `pnpm lint:docs`
- `pnpm test:packages`
- `node scripts/check-publish-deps.mjs` (existing — sanity-check that license additions didn't break anything)
- `node --test scripts/validate-package-manifests.test.mjs` (new — exercises validator's negative path)

### Milestone 2: Disclosure, supply-chain, and reviewer infrastructure

**Deliverable.** Security researchers have a working private channel and a public 5-business-day SLA; CoC reports have a real inbox; every PR auto-requests review from the maintainers team and merging is gated on a Code-Owner approval; Dependabot is keeping the dependency graph patched on a bounded weekly cadence; published versions emit auto-generated GitHub Release notes; first-time-contributor fork PRs cannot run secrets-bearing workflows without a maintainer's approval.

**Demonstrable end-state.** GitHub's *Security* tab shows "Report a vulnerability"; opening a draft PR auto-routes review to `@prisma/ORM-TS-Maintain` and shows "Review required"; `CODE_OF_CONDUCT.md` enforcement section names a contact channel that exists; `.github/dependabot.yml` is parsed cleanly by GitHub and at least one Dependabot PR has been opened within a week; a test publish produces a GitHub Release with auto-generated notes; the *Require approval for first-time contributors* setting is on.

**Tasks:**

- [ ] **2.1** *(admin)* Enable GitHub Private Vulnerability Reporting on the repo (*Settings → Code security and analysis → Private vulnerability reporting → Enable*). *(satisfies: TC-8)*
- [x] **2.2** Add `SECURITY.md` at the repo root containing: a *Scope* section explicitly listing the in-scope `@internal/*` packages and any explicit out-of-scope/lower-priority packages (e.g. internal/experimental); the disclosure channel (link to the GH Advisory form); the 5-business-day acknowledgement SLA; *Supported versions* stating that pre-1.0 only the latest minor receives security fixes; an instruction not to open public issues for security reports; the post-disclosure expectation that maintainers will coordinate a fix and disclosure timeline case-by-case. *(satisfies: TC-8)*
- [x] **2.3a** *(file)* Add `.github/CODEOWNERS` with a single rule: `* @prisma/ORM-TS-Maintain`. *(satisfies: TC-10 — file portion)*
- [ ] **2.3b** *(admin)* Update branch protection on `main` to (a) require ≥1 approving review from a Code Owner ("Require review from Code Owners" + "Require a pull request before merging"), (b) preserve all existing required status checks. Verify on a draft PR that GitHub recognises the team and auto-requests review, and that "Review required" appears as a merge blocker. *(satisfies: TC-10 — admin portion)*
- [x] **2.4** Update `CODE_OF_CONDUCT.md` enforcement section to name a real reporting channel: primary is `conduct@prisma.io` (or the alias actually provisioned per spec **Open Question 2**); fallback wording for private Discord channel if the alias is delayed. The change is localised — do not rewrite the rest of the Contributor Covenant content. *(satisfies: TC-9)*
- [ ] **2.5** *(admin)* Enable the GitHub setting *Settings → Actions → General → Fork pull request workflows from outside collaborators → Require approval for first-time contributors* (or the more-restrictive equivalent). Document the choice in the M2 PR description for visibility. *(satisfies: TC-11)*
- [x] **2.6** Add `.github/dependabot.yml` configuring two ecosystems: (a) `npm` at the workspace root with weekly schedule, grouped (one PR per ecosystem per week, splitting only between development-deps and runtime-deps if the volume warrants); (b) `github-actions` weekly. Set `target-branch: main`, set commit-message prefix consistent with conventional commits (e.g. `chore(deps)`), set `open-pull-requests-limit` to a sane bound (5 is a common default). Verify in the GitHub Dependabot tab that the config parses without errors. *(satisfies: TC-12)*
- [x] **2.7** Update `.github/workflows/publish.yml` to emit auto-generated GitHub Release notes after a successful publish. Implementation: gates on `dist-tag == 'latest'` (so dev/PR/beta builds publish to npm but skip the Release), uses `gh release create --generate-notes --target $GITHUB_SHA`, bumps `permissions.contents` from `read` to `write`. Wall-clock impact is a single `gh` API call (<2s), well inside NFR7. *(satisfies: TC-13, TC-22)*

**Validation gate:**

- `pnpm lint:rules`
- `pnpm lint:docs`
- `pnpm lint:manifests` (existing M1 check; should remain green)
- Manual: open draft PR — confirm `@prisma/ORM-TS-Maintain` is auto-requested AND merge is blocked on review
- Manual: visit Security tab — confirm "Report a vulnerability" is offered
- Manual: confirm fork PRs from new accounts require approval before workflows run
- Manual: trigger or wait for one Dependabot PR cycle; confirm config produces grouped PRs and not one-PR-per-dep firehose
- Manual: produce or simulate a publish run; confirm GitHub Release with auto-generated notes appears

### Milestone 3: Posture flip — DCO + contributor docs + templates + labels + skill

**Deliverable.** The repo is publicly open for external contributions: DCO is enforced as a required check, `CONTRIBUTING.md` is the self-contained entry point with a light-touch governance hint, the README invites contributions and warns about pre-1.0 stability with badges showing project liveness, PR/issue templates structure inbound participation, the label taxonomy enables triage with `good first issue` curated, and an agent-flavoured skill encodes the contribution path for LLM-using contributors. Project artifacts under `projects/oss-setup/` are then deleted as part of close-out.

**Demonstrable end-state.** The repo's Community Standards page is fully green; an unsigned commit on a test PR fails CI's DCO check and a signed amend passes it; `CONTRIBUTORS.md` no longer exists; the new skill loads and contains no internal-only references; `gh label list` returns the expected taxonomy; at least 3 issues are tagged `good first issue`.

**Tasks:**

- [ ] **3.1** *(admin)* Install the GitHub DCO App on the repo. Configure branch protection on `main` to add `DCO` to the required status checks (alongside existing `Type Check`, `Lint`, `Build`, `Test`, `E2E Tests`, `Integration Tests`, `Coverage`). Verify on a test PR. *(satisfies: TC-6, TC-7)*
- [x] **3.2** Write `CONTRIBUTING.md` at the repo root. The doc is **self-contained** — no redirects to `docs/onboarding/Getting-Started.md` or `AGENTS.md` as primary setup paths (those may be linked as deeper-dive references after the core flow). Sections, in order: *Welcome / scope*; *Pre-1.0 stability* (latest minor only, expect breakage between minors); *Prerequisites* (Node version per `engines.node`, pnpm via corepack, Docker for the cloudflare-worker integration test, otherwise tests run against PGlite); *Setting up locally* (clone, `pnpm install`, `pnpm build`); *Build / test / typecheck / lint commands* (the standard `pnpm` set with guidance on which suite covers which change scope); *Signing off your commits* (DCO mechanics: `git commit -s`, `git rebase --signoff`, the inbound=outbound Apache-2.0 statement: *"By submitting a contribution, you license it under the Apache-2.0 license already covering this project, and the `Signed-off-by:` trailer on each commit asserts your right to do so."*); *Before opening a PR for substantive changes* (the light-touch governance hint: open an issue first, maintainers respond within 5 business days indicating direction-fit); *Opening a pull request* (PR template expectations, link to the `contrib-pr` agent skill for agent users); *Discussing / asking questions* (Discord pointer); *Code of Conduct* (link). Apply the `markdown-no-artificial-line-wraps` convention. *(satisfies: TC-14, TC-15)*
- [x] **3.3** Update `README.md`: badges (license / npm `prisma-next` / CI), update the in-development callout to incorporate the pre-1.0 stability narrative, replace the closed-doors paragraph with a *Contributing* section linking `CONTRIBUTING.md` + `SECURITY.md`, leave Community section pointing at Discord. *(satisfies: TC-14, TC-16)*
- [x] **3.4** Delete `CONTRIBUTORS.md`. Verified `rg CONTRIBUTORS.md` returns only the project's own spec/plan (which document the deletion). *(satisfies: TC-16)*
- [x] **3.5** Add `.github/PULL_REQUEST_TEMPLATE.md`. Minimal checklist: *Linked issue (if any)*; *Summary of change*; *Testing performed*; *I have signed off all commits (`git commit -s`)*. No AI/agent authorship checkbox. *(satisfies: TC-14)*
- [x] **3.6** Add `.github/ISSUE_TEMPLATE/bug_report.yml`, `.github/ISSUE_TEMPLATE/feature_request.yml`, and `.github/ISSUE_TEMPLATE/config.yml`. Bug report includes a *Package and version* field, a *Reproduction* field, and a reminder that only the latest minor is supported. Feature request includes *Use case* and *Proposed shape*. The `config.yml` sets `blank_issues_enabled: false` and adds `contact_links` for: free-form questions (Discord) and security issues (pointing at the GH Advisories form with a *do not file public issues for security reports* note), plus a CONTRIBUTING.md pointer. *(satisfies: TC-14, TC-17)*
- [ ] **3.7** *(admin)* Configure the label taxonomy listed in spec FR19. Implementation choice (decided by maker): repo-settings provisioning OR `.github/labels.yml` synced via a labels-action. Survey existing open issues and tag 3–5 as `good first issue`; if none qualify, create 3–5 small-but-real issues at launch (typo fixes, doc gaps, small refactors a first-timer can complete) and tag those. *(satisfies: TC-18)*
- [x] **3.8** Add `.claude/skills/contrib-pr/SKILL.md` (resolves to `.agents/skills/contrib-pr/SKILL.md` via the workspace symlink). Frontmatter `name: contrib-pr` + `description`. Body covers: read `CONTRIBUTING.md`/`CODE_OF_CONDUCT.md`/`SECURITY.md`; confirm scope; run the right test suite; sign off commits; compose conventional-commit title and why-focused body; push to fork; `gh pr create`. Explicitly does NOT reference Linear, internal personas, `walkthrough`, `create-pr`, or any internal context. *(satisfies: TC-19, TC-21)*
- [ ] **3.9** Run the full validation gate locally before opening the M3 PR. The PR description references this spec/plan, references TML-2439, and includes a maintainer-facing note about the one-time `git rebase --signoff` cost for any in-flight branches at the moment of switchover. *(satisfies: TC-14)*

**Close-out tasks (folded into M3 final PR or a successor PR):**

- [ ] **3.10** Verify all acceptance criteria in `projects/oss-setup/spec.md` are met against the Test Design table; attach evidence (CI run links, screenshots of branch protection / Community Standards / Security tab / Dependabot tab / Releases page) to the close-out PR description.
- [ ] **3.11** Migrate long-lived design content from `projects/oss-setup/**` into durable homes. Candidate ADRs:
  - **ADR: Contributor-provenance via DCO (not CLA).** The DCO-over-CLA decision is durable; future re-evaluation requires re-opening the relicensing-optionality question.
  - **ADR: AI-authored contributions — verify the result, not the authorship.** Records the principle that the PR template / quality bar applies uniformly regardless of who/what produced the diff.
  - Optional **ADR: Pre-1.0 stability and supported-versions stance.** May be folded into the README/CONTRIBUTING content rather than an ADR if it doesn't feel architecturally durable.
  - Other transient project content (timelines, Slack-thread context, this plan itself) is genuinely transient and stays deleted.
- [ ] **3.12** Strip repo-wide references to `projects/oss-setup/**`. None should exist outside the project itself, but verify with `rg 'projects/oss-setup'`.
- [ ] **3.13** Delete `projects/oss-setup/`.

**Validation gate:**

- `pnpm lint:manifests`
- `pnpm lint:rules`
- `pnpm lint:rules:footprint` (new skill is added; footprint must validate)
- `pnpm lint:docs`
- `pnpm typecheck:packages`
- `pnpm test:packages`
- Manual: test PR with unsigned commit fails DCO; signed amend passes
- Manual: Community Standards page is fully green
- Manual: `gh label list` shows the expected taxonomy; ≥3 issues tagged `good first issue`
- Manual: filing a new issue presents the bug/feature forms with both Discord and security `contact_links`

## Open Items

Carrying forward from the spec's *Open Questions*:

1. **Relicensing-optionality Slack confirmation.** Out for response. If leadership signals optionality is wanted, M3 pauses and the provenance layer re-specs to CLA. **Default for execution:** proceed with DCO assuming silence-or-confirmation.
2. **CoC reporting alias provisioning.** Resolved during M2.4. If `conduct@prisma.io` is not stand-up-able within the project's lead time, ship the Discord-channel fallback and document the upgrade path.
3. **`@prisma/ORM-TS-Maintain` membership scope.** Validated during M2.3. If membership obviously misaligns with reviewer-of-record expectations, surface to the user.
4. **GitHub Discussions vs Discord-only.** Defaulted to Discord-only per spec. Revisit only if M3 review surfaces an objection.
5. **1.0 charter sentence.** Flag for the team. If charter criteria are offered before M3 close-out, fold into the README; otherwise leave as-is and surface as a recommendation in the close-out PR.
6. **Curated `good first issue` candidates.** Resolved during 3.7 via survey of existing issues OR creation of 3–5 small-but-real issues at launch.

Carrying forward from this plan:

7. **Repo-admin access required for several M2 and M3 tasks** — DCO App install (3.1), branch-protection edits (2.3, 3.1), PVR enable (2.1), first-time-contributor approval toggle (2.5), label provisioning if not via `.github/labels.yml` (3.7). Bundle these requests to the GH-org-settings owner listed in *Collaborators* to minimise round-trips. Confirm access before M2 starts.
8. **Dependabot grouping calibration (NFR6).** The initial grouping config in 2.6 is a best-effort starting point. After ~2–3 weekly cycles, audit the actual PR volume and re-group if maintainer surface is too high or too low.
9. **Auto-Release-notes wall-clock cost (NFR7).** Measured during 2.7. If addition exceeds 30s, split into a separate post-publish workflow.
