## 2026-08-14 — Reconcile review comments with the accepted spec

**Trigger:** Mandatory final project-close retro, incorporating the operator-flagged review-response failure on PR #30020.

**What happened:** The implementation delivered the requested Prisma 7 config coexistence behavior and CI caught one stale Bun init assertion. During human review, however, a comment rejecting newly added legacy JSON/JSONC/JSON5/YAML/YML/TOML bootstrap candidates was misread as rejecting the separately specified Prisma 7 JavaScript/TypeScript extension family. The response narrowed production behavior and rewrote the project spec before the operator corrected it; a follow-up restored the required family and removed only the unrequested formats.

**Root cause:** The review-response gate treated comment prose as a complete replacement requirement instead of inspecting the exact commented diff lines and reconciling them with the accepted spec. Once the mistaken interpretation was formed, the workflow made the durable spec conform to the implementation rather than using the spec to detect the contradiction and ask for clarification.

**What worked:** Installed-artifact coverage exercised both Prisma 7 entrypoints, the focused Docker E2E exposed the stale Bun filename assertion, reviewer rounds caught explicit-path attribution and bootstrap ordering issues, and the final CI suite passed before merge.

**Landing surface(s):**

- Project-context: `drive/code-review/README.md` § Anti-patterns — require exact-hunk inspection and spec reconciliation before review feedback changes accepted scope.
- Project-context: `drive/pr/README.md` § Known constraints & gaps — record that review comments are requirements input, not automatic spec replacements.
