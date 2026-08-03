# Summary

Flip Prisma Next from "public for observation, no contributions" to "open for external contributions" by closing the gaps that make external participation unsafe today: missing license declarations on published npm packages, no documented contribution path, no vulnerability disclosure channel, no contributor-provenance mechanism, and no reviewer routing for inbound PRs. Also raise baseline OSS hygiene (NOTICE audit, Code of Conduct enforcement contact) so published artifacts and community processes meet expectations of enterprise consumers and outside contributors.

# Context

## At a glance

Prisma Next is currently *public for observation*: the source is on GitHub and packages publish to npm, but `CONTRIBUTORS.md` explicitly says no PRs, no issues, no feedback channel. We're reversing that decision. After this project lands, an external contributor visiting the repo will find a clear path in (`CONTRIBUTING.md` linked from the README), every published package will declare `Apache-2.0`, security researchers will have a working private disclosure channel (GitHub Security Advisories), every commit on a PR will need a `Signed-off-by:` trailer (DCO) before merge, every PR will auto-route to the `@prisma/ORM-TS-Maintain` maintainers team via `CODEOWNERS`, and a contributor-flavoured agent skill will guide LLM-using contributors into a high-quality PR by construction rather than by enforcement.

Concretely, the shipped state at end of project:

```
LICENSE                              # unchanged (Apache-2.0)
CODE_OF_CONDUCT.md                   # updated: real reporting alias
CONTRIBUTING.md                      # NEW: setup, signoff, stability, governance hint
SECURITY.md                          # NEW: GH Advisories + 5-biz-day SLA + scope
NOTICE                               # NEW iff §4(d) audit requires
CONTRIBUTORS.md                      # DELETED (content folded into CONTRIBUTING/README)
README.md                            # updated: Contributing section, stability, badges
.github/CODEOWNERS                   # NEW: * @prisma/ORM-TS-Maintain
.github/dependabot.yml               # NEW: npm + github-actions, grouped weekly
.github/PULL_REQUEST_TEMPLATE.md     # NEW
.github/ISSUE_TEMPLATE/               # NEW: bug, feature, config (security + Discord)
.github/labels.yml                   # NEW (or repo-settings labels): minimum taxonomy
scripts/validate-package-manifests.mjs   # NEW: CI-enforced license-field check
scripts/audit-notice.mjs             # NEW: §4(d) NOTICE audit
.github/workflows/ci.yml             # updated: invoke the new manifest check
.github/workflows/publish.yml        # updated: emit auto-generated GitHub Release notes
.claude/skills/contrib-pr/SKILL.md   # NEW: pit-of-success skill for agent-using contributors

# Per-package, every publishable package.json:
"license": "Apache-2.0"               # NEW field
```

External-facing PR check requirements after this lands: existing CI checks (typecheck, lint, build, fixtures, test, e2e, integration, coverage, semgrep, secret-detection) **plus** DCO sign-off (GitHub DCO App) **plus** the new manifest validator (inside the existing `lint` job) **plus** ≥1 approving review from a `@prisma/ORM-TS-Maintain` CODEOWNER.

Repository settings changes (in addition to the file changes above): GitHub Private Vulnerability Reporting enabled; "Require approval for first-time contributors" enabled for fork PR workflows; branch protection on `main` updated to (a) add `DCO` to required status checks, (b) require ≥1 approving review from a Code Owner.

## Problem

The repo currently advertises a closed contribution posture in `CONTRIBUTORS.md`:

> *We are not accepting code contributions (no pull requests). We are not accepting bug reports or feature requests (no GitHub issues/discussions as a feedback channel). You should not build applications on this yet.*

Leadership has decided to reverse that posture. Doing so naively — just merging a PR that says "we now accept contributions" — leaves a set of gaps that range from minor friction to genuine legal/operational risk:

1. **License declaration on npm.** Sampled `@internal/target-postgres`, `@internal/target-sqlite`, `@internal/adapter-postgres`, `@internal/adapter-sqlite`, `@internal/driver-sqlite` — none declare `"license"` in `package.json`. There are ~60 publishable packages in the workspace (everything under `packages/**` that isn't `"private": true` — see `scripts/list-publishable-packages.mjs`), and the same gap exists across most of them. Result: tarballs we ship today don't carry license metadata, so license scanners (Snyk, FOSSA, `license-checker`) flag them as unknown/unlicensed and enterprise consumers will be blocked from depending on them. This is a correctness issue independent of contribution posture.
2. **No documented contribution path.** No `CONTRIBUTING.md`, no commit/PR conventions, no signoff instructions. A drive-by contributor today has nothing to follow; a serious contributor has to reverse-engineer conventions from `AGENTS.md` (which is internal-flavoured).
3. **No security disclosure channel.** No `SECURITY.md`. GitHub's community standards check flags this. Researchers either open public issues against published packages (worst case for impact) or don't report (worst case for users). The repo *does* have GitHub Private Vulnerability Reporting available — it's just not turned on or advertised.
4. **No contributor-provenance mechanism.** Apache-2.0 inbound=outbound is implicit but unverified. We have no per-commit assertion that contributors have the right to submit, and no enforced check that says so. For a project planning to take outside contributions, that's the exposure CLAs and DCO exist to close.
5. **No reviewer routing.** No `CODEOWNERS`. Once external PRs start arriving, GitHub does not auto-assign anyone; PRs sit until a maintainer notices.
6. **`CODE_OF_CONDUCT.md` defines an enforcement ladder but does not say where to send a report.** It references "maintainers and moderators" without giving anyone a contact channel. Currently unactionable.
7. **No issue/PR templates.** Inbound issues and PRs land as free-form prose. Triage cost scales worse than linearly with volume.
8. **`NOTICE` audit not done.** Apache-2.0 §4(d) requires propagating any `NOTICE` files from Apache-2.0 transitive deps we redistribute. We may or may not be obliged today; we don't currently know.
9. **Existing AI-authored contributions paragraph in `CONTRIBUTORS.md` is half-decided and unenforceable.** It promises "intent artifact required" without defining the artifact, capturing it anywhere, or specifying what verifies it. The moment we open contributions, that paragraph activates as policy.

The project addresses all of the above in one coordinated push.

## Approach

The work decomposes into four layers, ordered by leverage:

**Correctness layer (publish hygiene).** Add `"license": "Apache-2.0"` to every publishable `package.json`. Add a CI-enforced validator (`scripts/validate-package-manifests.mjs`) modelled on the existing `validate-rules.mjs` / `check-publish-deps.mjs` pattern, wired into the `lint` job in `.github/workflows/ci.yml`. The validator owns this rule going forward: it fails CI if any publishable package adds without declaring a license.

**Provenance layer (DCO).** Adopt DCO as the contributor-provenance mechanism (lightweight `Signed-off-by:` per commit, the modern OSS default — Linux, Git, Kubernetes, most CNCF). Enforcement is the **GitHub DCO App** installed on the repo with `DCO` set as a required PR check. `CONTRIBUTING.md` documents the workflow (`git commit -s`, `git rebase --signoff` for fixups) and asserts the inbound license model: *"By submitting a contribution, you license it under the Apache-2.0 license already covering this project."*

**Safety layer (disclosures + reviewers + fork-PR safety).** Enable **GitHub Private Vulnerability Reporting** on the repo. Add `SECURITY.md` pointing researchers there as the primary channel, with a 5-business-day acknowledgement SLA, explicit scope (which `@internal/*` packages are in scope), "the maintainers" as the responder body, and an explicit pre-1.0 supported-versions stance ("only the latest minor; no version-line backports"). Add `.github/CODEOWNERS` containing `* @prisma/ORM-TS-Maintain`, so every inbound PR auto-requests review from the maintainers team. Update branch protection on `main` to (a) add `DCO` to required status checks (in coordination with the provenance layer below), (b) require ≥1 approving review from a Code Owner — so the auto-request is not merely advisory. Enable the GitHub setting *"Require approval for first-time contributors"* for fork PR workflows: a single toggle that closes the most common fork-PR abuse vector (a hostile first-time contributor's CI workflow running unreviewed) and is independent of the broader fork-PR audit deferred elsewhere. Add the missing reporting alias (`conduct@prisma.io` or equivalent) to `CODE_OF_CONDUCT.md`'s enforcement section.

**Supply-chain layer.** Add `.github/dependabot.yml` covering both `npm` (root + grouped weekly to keep the maintainer surface to one PR per ecosystem per week, not 60) and `github-actions` (the workflows already pin actions to SHAs, but those pins drift without Dependabot bumping them). Update `.github/workflows/publish.yml` to emit auto-generated GitHub Release notes on each publish, using the conventional-commit titles already produced by the existing `create-pr` skill — this is the cheap path to a *changelog channel* for downstream consumers. Per-package `CHANGELOG.md` files via changesets are deferred to 1.0; for a pre-1.0 fast-moving project the per-PR fragment hygiene does not yet pay off.

**Discovery layer (docs + templates + skill).** Write `CONTRIBUTING.md` covering: prerequisites and setup commands **inline** (Node/pnpm versions, whether Docker is needed for which test suites, the actual `pnpm` command set), signoff workflow, PR expectations, the pre-1.0 stability narrative, a *light-touch governance hint* ("for substantive changes, please open an issue first; maintainers respond within 5 business days indicating direction-fit before you sink time into a PR"), and a link to the agent skill. The setup section is self-contained — it does **not** redirect external contributors at the existing `docs/onboarding/Getting-Started.md`, which is internal-flavoured (links back to `AGENTS.md`, assumes Cursor cloud-agent context). Replace the closed-posture content of `CONTRIBUTORS.md` (delete the file; fold the Discord pointer into `CONTRIBUTING.md` and the README; let GitHub's auto-generated contributors list handle attribution). Update the README with a short Contributing section, the stability statement, and standard badges (license, npm version of the headline package, CI status). Add minimal PR template (linked issue, summary, testing done, signoff reminder) and issue templates (bug, feature) with a `config.yml` that disables blank issues, redirects free-form questions to Discord, and surfaces a security-issue contact link pointing at `SECURITY.md` (catching researchers who try to file a public security issue at the point of error). Configure a minimal label taxonomy (`bug`, `enhancement`, `documentation`, `good first issue`, `help wanted`, `needs-triage`, `dependencies`) and curate 3–5 starter issues as `good first issue` so the project signals visible entry-points. Add a new `.claude/skills/contrib-pr/SKILL.md` aimed at *external* contributors using agents — distinct from the existing maintainer-focused `.claude/skills/create-pr/SKILL.md` which assumes Linear access, internal plan/spec context, and `walkthrough` skill availability.

**One-time audit (NOTICE).** Walk transitive runtime dependencies of every publishable package; collect any `NOTICE`/`NOTICE.txt` files from Apache-2.0-licensed deps; if any exist and our packages redistribute them, generate a root `NOTICE` file aggregating them per §4(d). If none oblige us, record the audit result in `projects/oss-setup/assets/notice-audit.md` for the close-out and skip the file. The audit is a script under `scripts/audit-notice.mjs` so it can be re-run later.

The AI-authored-contribution policy from `CONTRIBUTORS.md` is **not** carried forward. The principle that replaces it: verify the result, not the authorship. The PR template applies the same quality bar regardless of who or what produced the diff. The `contrib-pr` skill is the pit-of-success expression of that bar for agent users — it walks through the same expectations the PR template enforces (tests pass, sign off the commit, link the issue, fill the template) without enforcement gates and without authorship questions.

DCO forecloses cheap relicensing later: contributions become permanently Apache-2.0 inbound=outbound, and a future relicensing pivot would require either re-signing every contributor or rewriting every contribution. This trade-off is accepted, conditional on leadership confirming no relicensing intent in a 3–5 year horizon (Slack thread tracked in **Open Questions**).

# Requirements

## Functional Requirements

### Publish hygiene

- **FR1.** Every publishable `package.json` (every `package.json` under `packages/**` that does not have `"private": true`, as enumerated by `scripts/list-publishable-packages.mjs`) declares `"license": "Apache-2.0"`.
- **FR2.** A new script `scripts/validate-package-manifests.mjs` validates that every publishable `package.json` declares `"license": "Apache-2.0"` and exits non-zero with a per-package error report if any are missing or set to a different value.
- **FR3.** The new validator is invoked from the `lint` job in `.github/workflows/ci.yml` so missing/incorrect license declarations fail PR CI. The validator is also exposed as a top-level `pnpm` script (e.g. `pnpm lint:manifests`) so contributors can run it locally.
- **FR4.** A NOTICE audit script (`scripts/audit-notice.mjs`) walks transitive runtime dependencies of every publishable package, identifies any Apache-2.0-licensed deps that ship a `NOTICE` file, and prints a report. If §4(d) obligates us to propagate notices, a root `NOTICE` file is generated and committed.

### Provenance

- **FR5.** The GitHub DCO App is installed on the repo and the `DCO` check is set as a required PR check on `main`. Branch protection on `main` requires the DCO check to pass before merge.
- **FR6.** `CONTRIBUTING.md` documents the DCO workflow: how to sign commits (`git commit -s`), how to fix unsigned history (`git rebase --signoff`), and asserts the inbound=outbound Apache-2.0 license statement.

### Safety / disclosure

- **FR7.** GitHub Private Vulnerability Reporting is enabled on the repository.
- **FR8.** `SECURITY.md` exists at the repo root with: the disclosure channel (a link to the GH Advisory form); the acknowledgement SLA (within 5 business days); a *Scope* section stating that all published `@internal/*` packages are in scope and listing any known internal/experimental packages that are explicitly out of scope or lower priority; a "supported versions" section stating that pre-1.0 only the latest minor version receives security fixes; and an instruction to *not* file public issues for security reports.
- **FR9.** `CODE_OF_CONDUCT.md` includes a real reporting channel for enforcement (a `conduct@`-style email alias as primary; a private Discord channel as documented fallback).
- **FR10.** `.github/CODEOWNERS` contains a single rule `* @prisma/ORM-TS-Maintain` and is recognised by GitHub. Branch protection on `main` is updated to require ≥1 approving review from a Code Owner (so the auto-request is enforcing, not advisory) in addition to the existing required status checks.
- **FR11.** The repository setting *Settings → Actions → General → Fork pull request workflows from outside collaborators → Require approval for first-time contributors* is enabled, so a first-time contributor's CI does not run secrets-bearing workflows without a maintainer's manual approval.

### Supply-chain hygiene

- **FR12.** `.github/dependabot.yml` exists and configures Dependabot for both `npm` (workspace root, grouped weekly) and `github-actions` (workflows already pin to SHAs; Dependabot bumps the pins). Dependabot PRs target `main` and follow the same DCO and CODEOWNERS rules as human-authored PRs.
- **FR13.** `.github/workflows/publish.yml` is updated to emit auto-generated GitHub Release notes for each published version, using conventional-commit-shaped titles already enforced by the existing PR-authoring conventions. The Release artifact contains the version tag, the changelog of merged PRs since the previous release, and links to the published npm packages.

### Discovery

- **FR14.** `CONTRIBUTING.md` exists at the repo root and is **self-contained** for an external contributor (does not redirect to `docs/onboarding/Getting-Started.md` or other internal-flavoured docs). It covers: prerequisites (Node version per `engines.node`, pnpm via corepack, whether Docker is needed for which test suites — explicitly noting that the cloudflare-worker integration test requires `docker compose` and that other suites run via PGlite); setup and first-build commands; the test/lint/typecheck command set with guidance on which suite to run for a given change scope; signoff workflow (FR6); PR expectations (template, scope, conventional commit hint); pre-1.0 stability narrative; a *Before opening a PR for substantive changes* paragraph instructing contributors to open an issue first for direction-fit feedback (maintainers respond within 5 business days); and a pointer to the `contrib-pr` skill for agent users. Existing internal docs (`AGENTS.md`, `docs/onboarding/`) remain as maintainer-onboarding artifacts and may be linked as *deeper-dive* references but not as primary entry points.
- **FR15.** `README.md` includes a *Contributing* section linking to `CONTRIBUTING.md`, a stability statement (*"Pre-1.0, expect breaking changes between minor versions. No security backports below the latest minor. Do not build production applications on Prisma Next without expecting to upgrade frequently."*), a *Community* section pointing at Discord, and standard badges at the top (license, npm version of `@internal/prisma-next` or the headline published package, CI status).
- **FR16.** `CONTRIBUTORS.md` is deleted. The Discord pointer it currently carries is folded into `CONTRIBUTING.md` and the README per FR14/FR15. The AI-authored-contributions paragraph is **not** carried forward; the new posture verifies the result, not the authorship.
- **FR17.** `.github/PULL_REQUEST_TEMPLATE.md` exists with a minimal checklist: linked issue (if any), summary of change, testing performed, "I have signed off all commits". It does **not** ask about AI/agent authorship.
- **FR18.** `.github/ISSUE_TEMPLATE/` contains form-based templates for `bug_report.yml`, `feature_request.yml`, and a `config.yml`. The `config.yml` sets `blank_issues_enabled: false` and contains `contact_links` for: free-form questions (Discord) and security issues (`SECURITY.md` with a *do not file public issues for security reports* note). Bug report includes a "package and version" field and a reminder that only the latest minor is supported.
- **FR19.** A minimal label taxonomy is configured on the repo: `bug`, `enhancement`, `documentation`, `good first issue`, `help wanted`, `needs-triage`, `dependencies`. The implementation may be repo-settings-only or via `.github/labels.yml` — either is acceptable. As part of the launch, 3–5 issues are curated as `good first issue` so the project signals concrete entry-points to first-time contributors.
- **FR20.** A new agent skill `.claude/skills/contrib-pr/SKILL.md` exists, targeted at *external* contributors using LLM-based agents. It is distinct from the maintainer-focused `.claude/skills/create-pr/SKILL.md`. It encodes the contribution expectations from `CONTRIBUTING.md` and the PR template as a workflow: read CONTRIBUTING, scope the change, ensure tests pass, sign the commit, fill the PR template, link the issue. It does **not** depend on Linear access, internal plan/spec docs, or other internal-only context.

## Non-Functional Requirements

- **NFR1.** The manifest validator (FR2) runs in under 5 seconds on the workspace's ~60 publishable packages so it does not materially slow PR CI's `lint` job.
- **NFR2.** All new docs (`CONTRIBUTING.md`, `SECURITY.md`, `README.md` updates, templates) pass the project's existing documentation conventions: no hard-wrapped lines (per `markdown-no-artificial-line-wraps` skill), repo-relative links where appropriate, no links into transient `projects/` artifacts.
- **NFR3.** The DCO required-check addition does not block existing maintainer workflows: maintainers can sign commits via `git commit -s` (already supported by `git config alias`/aliases). No automation that creates commits server-side without sign-off may be introduced as part of this work.
- **NFR4.** The license-field changes do not produce visible diffs in any tarball other than the `package.json` itself: no version bumps, no other manifest changes triggered by this work.
- **NFR5.** The `contrib-pr` skill assumes only public information available to an external contributor: no references to internal Slack channels, Linear projects, internal plan/spec docs, or skills/personas not present in the public repo.
- **NFR6.** Dependabot's PR volume is bounded — `npm` updates are grouped to roughly one PR per ecosystem per week (configurable per the Dependabot grouping syntax). The maintainer surface produced by Dependabot must not exceed what the existing maintainer team can reasonably triage.
- **NFR7.** The auto-generated GitHub Release workflow does not delay the existing publish flow's wall-clock time by more than 30 seconds; if it does, fall back to a separate workflow that runs after `publish.yml` completes.

## Non-goals

- **Full fork-PR CI safety audit.** The first-time-contributor workflow approval toggle (FR11) closes the most common abuse vector cheaply; the broader audit (full review of `pull_request_target` usage, action pinning depth, GITHUB_TOKEN permission scoping per workflow, OIDC token surface in `publish.yml`) remains a separate ticket.
- **Trademark / branding policy.** Out of scope; will be a separate design effort with legal involvement.
- **Governance model, maintainers list, RFC process.** Defer until contribution volume warrants — the flat `CODEOWNERS` plus the *light-touch* "open an issue first" paragraph in `CONTRIBUTING.md` (FR14) is sufficient for v1.
- **Domain-aligned `CODEOWNERS`.** Out of scope for v1; the flat rule is the minimum credible commitment.
- **AUTHORS / MAINTAINERS / GOVERNANCE files.** Lower priority; defer.
- **CLA.** Explicitly not chosen; DCO is the path. Re-evaluating this would require revisiting the relicensing-optionality decision.
- **Relicensing decisions or commercial-licensing decisions.** Surfaced only as input to the DCO/CLA call.
- **Stability declaration ahead of 1.0.** The narrative is "pre-1.0, expect breakage"; we are not declaring API stability.
- **Backporting security fixes to old minors.** Pre-1.0, only the latest minor is supported; this is documented, not implemented.
- **Refactoring `AGENTS.md` / internal docs to be contributor-facing.** `AGENTS.md` and `docs/onboarding/Getting-Started.md` remain internal/maintainer-onboarding artifacts; `CONTRIBUTING.md` becomes the external entry point and is self-contained.
- **Per-package `CHANGELOG.md` files via changesets.** Auto-generated GitHub Releases (FR13) is the v1 channel for breaking-change communication. Changesets-style per-PR fragments are a 1.0-readiness concern.
- **Dependency license-compatibility scanning.** A follow-up; the NOTICE audit (FR4) will surface egregious cases incidentally.
- **Full SBOM (CycloneDX/SPDX) generation on release.** npm provenance attestations (already enabled) cover the core ask; full SBOM is a 1.0/enterprise concern.
- **Stale-issue / stale-PR automation.** Defer until volume warrants; flagged for revisit at "first 50 issues" threshold.
- **CodeQL on top of the existing Semgrep workflow.** `pr-code-security.yml` already runs Semgrep with `--config auto` plus the prisma-org secret-detection workflow; CodeQL would partially duplicate. Defer unless a specific need surfaces.
- **GPG-signed-commit requirement in addition to DCO.** Heavier friction, marginal additional security; not aligned with the low-friction default.

# Acceptance Criteria

## Publish hygiene + audit

- [ ] **AC1.** Every publishable `package.json` declares `"license": "Apache-2.0"`. Verifiable by: `pnpm lint:manifests` exits 0; `node scripts/list-publishable-packages.mjs | xargs -n1 -I{} node -e 'const p=require("{}/package.json"); if(p.license!=="Apache-2.0") {console.error("{}",p.license);process.exit(1)}'` exits 0. Covers FR1.
- [ ] **AC2.** Removing the `license` field from any one publishable `package.json` and running `pnpm lint:manifests` produces a non-zero exit code with that package named in the error output. Covers FR2, FR3.
- [ ] **AC3.** PR CI's `lint` job invokes the manifest validator. Verifiable by: opening a PR with a stripped license field — the `lint` job fails with the manifest validator error. Covers FR3.
- [ ] **AC4.** A `tarball=$(pnpm pack <publishable-package> 2>&1 | tail -1) && tar -xOf "$tarball" package/package.json | jq -r .license` returns `"Apache-2.0"` for at least one publishable package, confirming the license declaration survives `pnpm pack`. Covers FR1.
- [ ] **AC5.** The NOTICE audit script runs to completion and produces a report. If §4(d) obligates a `NOTICE`, the file exists at the repo root with the aggregated notices; if not, `projects/oss-setup/assets/notice-audit.md` records the audit result and the basis for skipping the file. Covers FR4.

## Provenance

- [ ] **AC6.** A test PR with one or more commits **lacking** `Signed-off-by:` trailers has the DCO check fail; adding `git commit --amend -s` (or `git rebase --signoff`) and force-pushing makes the DCO check pass. Covers FR5.
- [ ] **AC7.** `main` branch protection lists `DCO` among the required status checks, alongside the existing `Type Check`, `Lint`, `Build`, `Test`, `E2E Tests`, `Integration Tests` checks. Verifiable via `gh api repos/:owner/:repo/branches/main/protection`. Covers FR5.

## Safety / disclosure

- [ ] **AC8.** Visiting the repo's Security tab on GitHub displays "Report a vulnerability" (i.e. Private Vulnerability Reporting is on) and the link from `SECURITY.md` lands on a working report form. `SECURITY.md` declares scope (in-scope `@internal/*` packages, any out-of-scope/lower-priority packages), the 5-business-day acknowledgement SLA, and the pre-1.0 supported-versions stance. Covers FR7, FR8.
- [ ] **AC9.** `CODE_OF_CONDUCT.md` enforcement section names a real reporting channel (email or private Discord channel) — not the placeholder "maintainers and moderators" with no contact. Covers FR9.
- [ ] **AC10.** Opening a PR auto-requests review from `@prisma/ORM-TS-Maintain` AND merging is blocked until ≥1 approving review from a Code Owner is present (in addition to status checks). Verifiable on a test PR: a passing-CI test PR with no reviews shows "Review required" merge blocker. Covers FR10.
- [ ] **AC11.** Repo Settings → Actions → General shows *"Require approval for first-time contributors"* enabled (or the equivalent more-restrictive option). Verifiable by attempting a fork PR from a fresh account: workflow runs are gated on a maintainer's approval before any secrets are exposed. Covers FR11.

## Supply-chain hygiene

- [ ] **AC12.** `.github/dependabot.yml` is parseable by Dependabot (validated by GitHub's Dependabot tab showing the configured ecosystems with no errors), and Dependabot opens at least one PR within a week of landing — verifying the configuration takes effect. PR volume conforms to the grouping configured in NFR6. Covers FR12, NFR6.
- [ ] **AC13.** A publish run produces a corresponding GitHub Release with auto-generated notes referencing the merged PRs since the previous release and links to the published npm packages. Verifiable by inspecting the Releases page after a test publish (or via `gh release view <tag>`). Covers FR13.

## Discovery

- [ ] **AC14.** GitHub's *Community Standards* checklist for the repo (`/community` tab) reports green for: README, Code of Conduct, Contributing, License, Security, Issue templates, PR template. Covers FR8, FR9, FR14, FR17, FR18.
- [ ] **AC15.** `CONTRIBUTING.md` is self-contained for an external contributor: a fresh clone + the documented commands (Node version, pnpm install, build, the test suite suited to the change scope) is enough to run the relevant tests without consulting `AGENTS.md` or `docs/onboarding/Getting-Started.md`. Verifiable by manually following the doc on a fresh checkout. The doc also contains the *open-an-issue-first-for-substantive-changes* paragraph and a pointer to the `contrib-pr` skill. Covers FR14.
- [ ] **AC16.** The repo's `CONTRIBUTORS.md` no longer exists. The README's *Contributing* section links to `CONTRIBUTING.md`. The pre-1.0 stability statement and the README badges (license, npm version, CI status) are present. Covers FR15, FR16.
- [ ] **AC17.** Filing a new issue on the repo presents the bug-report and feature-request forms; "blank issue" is disabled; the chooser surfaces `contact_links` for both Discord (free-form questions) and security reporting (pointing at `SECURITY.md`). Covers FR18.
- [ ] **AC18.** The labels listed in FR19 exist on the repo (verifiable via `gh label list`). At least 3 issues are tagged `good first issue` at the time of project completion. Covers FR19.
- [ ] **AC19.** The `contrib-pr` skill is loadable via the agent skills system (frontmatter parses, `name`/`description` present, instructions self-contained for external contributors with no internal context). Verifiable by reading the file plus a smoke check that it does not reference Linear, internal Slack channels, internal plan docs, the `walkthrough` skill, or persona-library entries unavailable to externals. Covers FR20, NFR5.

# Other Considerations

## Security

The GitHub Private Vulnerability Reporting channel is the primary disclosure path. The `SECURITY.md` file does **not** publish a PGP key in v1; we rely on GitHub's transport for the report, and downstream encrypted communication can be arranged case-by-case. We do not publish the internal triage process; the public file commits only to the 5-business-day acknowledgement SLA. The `CODE_OF_CONDUCT.md` reporting alias should be operationally distinct from the security channel — different responder pool, different escalation paths.

Fork-PR CI safety (the risk that a hostile PR exfiltrates secrets via CI) is **out of scope** for this project but is a known follow-up. The publish workflow uses OIDC trusted publishing and only runs on `push: main`, not on fork PRs, so the immediate exposure is limited. The follow-up audit covers `pull_request_target` usage, action pinning depth, and GITHUB_TOKEN permission scoping.

## Cost

Operating cost: zero incremental cloud spend. The DCO App is free for public OSS. GH Private Vulnerability Reporting is built into GitHub. Engineering cost is the work itself plus the recurring cost of triaging inbound PRs/issues — that's the operational consequence of opening up, not something this project's design can mitigate.

## Observability

No observability infrastructure to provision. The relevant signals are:

- DCO check pass/fail rate on PRs — visible in GitHub PR check history.
- Manifest validator failures in CI — visible in PR CI logs.
- Time-to-first-response on inbound issues / PRs / security reports — observable via GitHub's Insights tab; not instrumented here.

## Data Protection

The new repo files do not process personal data. The GitHub Advisory channel and CoC alias receive personal data (reporter contact info) handled by existing GitHub / mail systems under existing Prisma data-handling policy. No GDPR-sensitive new processing is introduced by this project.

## Analytics

No analytics events. The project's success is measured qualitatively (community standards green, first external PR merges cleanly, no license-scanner blocks reported by enterprise consumers) rather than via instrumented telemetry.

# References

- Linear ticket: [TML-2439](https://linear.app/prisma-company/issue/TML-2439/oss-setup-enable-safe-external-contributions-and-complete-repo-oss)
- Existing closed-posture document being replaced: `CONTRIBUTORS.md`
- Existing CI workflow modified by this work: `.github/workflows/ci.yml`
- Existing publish workflow (unchanged by this work): `.github/workflows/publish.yml`
- Pattern for the new validator: `scripts/validate-rules.mjs`, `scripts/check-publish-deps.mjs`, `scripts/validate-package-readmes.mjs`
- Publishable-package enumeration: `scripts/list-publishable-packages.mjs`
- Code of Conduct base: Contributor Covenant v3.0 (already vendored)
- DCO mechanics: <https://developercertificate.org/>
- DCO GitHub App: <https://github.com/apps/dco>
- GitHub Private Vulnerability Reporting docs: <https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability>
- Dependabot configuration reference: <https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference>
- "Require approval for first-time contributors" setting: <https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository#configuring-required-approval-for-workflows-from-public-forks>
- Auto-generated GitHub Release notes: <https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes>
- Existing security workflows referenced for context (not modified by this work): `.github/workflows/pr-code-security.yml` (Semgrep + secret detection)

# Open Questions

1. **Relicensing optionality (Slack thread).** The DCO choice rests on leadership confirming no realistic intent to move Prisma Next off pure Apache-2.0 (open-core split, commercial dual-license, BSL/SSPL pivot) within ~3–5 years. A Slack thread to the leadership channel is going out before/during execution. If leadership pushes back and signals optionality is wanted, the DCO call reverts to CLA and this spec is updated (provenance layer changes shape: CLA Assistant integration, contributor click-through, additional doc).

   **Default for execution:** proceed with DCO; if the Slack thread comes back negative, pause the DCO milestone and re-spec.

2. **CoC reporting alias provisioning.** Preferred channel is a dedicated `conduct@prisma.io`-style email alias. If standing up a new alias has internal process cost that pushes this beyond the project's scope, fall back to a private Discord channel with documented `@moderators` role for v1 and revisit the email later.

   **Default for execution:** request the alias from the appropriate internal owner; if not available within the project's lead time, ship Discord-channel fallback and document the upgrade path.

3. **`@prisma/ORM-TS-Maintain` GH team membership scope.** The team exists; the assumption is that its current membership is appropriate to act as the public-facing maintainers-of-record. If membership is too broad or too narrow for that role, the implementer may need to surface a membership change request.

   **Default for execution:** use the team as-is; surface only if membership obviously misaligns with reviewer-of-record expectations.

4. **Whether to pre-emptively configure GitHub Discussions as the "questions" channel** in addition to Discord. The current direction is Discord-only (carried forward from `CONTRIBUTORS.md`); the issue templates' `config.yml` will redirect free-form questions to Discord. If we'd rather use GitHub Discussions, the `config.yml` and CONTRIBUTING.md links change accordingly.

   **Default for execution:** Discord-only; do not enable GH Discussions in this project.

5. **1.0 charter.** What are the criteria for moving Prisma Next from pre-1.0 to 1.0? The README's *"pre-1.0, expect breakage"* stance is honest, but it is also a promise: at some point you hit 1.0 and the contract with downstream consumers changes shape (migration paths, deprecation cycles, stable APIs become owed). If the team has even rough criteria ("when SQL + Mongo + adapter migration are stable"), one sentence in the README makes adopters' planning much cheaper.

   **Default for execution:** flag for the team — do not block the project on it. If a charter sentence is offered before close-out, fold it into the README; otherwise leave the stability statement as-is and surface as a recommendation in the close-out PR.

6. **Curated `good first issue` set.** FR19 calls for 3–5 issues to be tagged at launch. The implementer surfaces candidate issues; the maintainer team confirms before tagging. If there are no genuinely small / well-scoped issues currently open, this becomes "create 3–5 small issues at launch" instead.

   **Default for execution:** survey existing open issues for fit; if none qualify, create 3–5 new small-but-real issues (typo fixes, doc gaps, small refactors a first-timer can complete) at launch.
