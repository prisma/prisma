# functional-indexes — handoff

Orientation for an agent picking this project up cold. The design is **settled and operator-approved**; your job is delivery, not re-design.

## What this project is

Expression (functional) indexes (`CREATE INDEX … USING btree (eql_v3.eq_term(email))`), partial indexes, and unique expression indexes — requested by the ciphers team — plus the identity change that makes them verifiable: **all indexes become name-identified** with ADR-234 content-addressed wire names (`<prefix>_<8hex>`), and both indexes and RLS policies gain an **exact-name mode** (`map:`) whose equivalence is content comparison, closing the `contract infer` round-trip so a live database can be inferred, emitted, and verified with zero operations.

## Read in this order

1. [spec.md](spec.md) — the whole design: the one identity rule, the normative scenario matrix A–J, decisions D1–D10. **Every implementation question is answered there deliberately** (exact field lists, hash tuple, PSL/TS parameter matrices with diagnostic codes, `isEqualTo` strategy matrix, introspection queries, rename-pairing algorithm, infer rules, warning wording). If you find yourself making a design choice, you've missed a spec section — go back.
2. [plan.md](plan.md) — four slices with boundaries; slice N's DoD points at spec scenario letters.
3. [specs/adr-name-identified-indexes.md](specs/adr-name-identified-indexes.md) — the rationale record; migrates to `docs/architecture docs/adrs/` at close-out.
4. Background ADRs: 234 (wire names), 235 (the differ), 210 (index types), 009 (default names).
5. Substrate precedent: postgres-rls is **closed out** ([#979](https://github.com/prisma/prisma-next/pull/979)); its decisions live as promoted ADRs (234, 235) and merged PRs ([#947](https://github.com/prisma/prisma-next/pull/947) for the constraint/index node split). The operating conventions it established are carried in this handoff.

## Hard constraints (do not relitigate)

- **Slice 0 dependency: resolved (2026-07-23).** Postgres-rls slice 2.6 merged as [#947](https://github.com/prisma/prisma-next/pull/947), but it kept `SqlUniqueIR` and `SqlIndexIR` as two structural nodes rather than deleting `SqlUniqueIR` as originally assumed. The operator confirmed the two-node substrate is correct (an index must not carry a constraint marker — discrete-entities principle, ADR 161 superseding note), and spec/plan are amended: name identity covers index nodes and policies; unique constraints stay tuple-identified.
- **Scenario A is non-negotiable:** infer → emit → verify = zero issues, plan = zero ops, against the same database.
- **No SQL parsing, ever.** Expression/where/predicate bodies are opaque strings; hashing uses the shared minimal normalizer only.
- **No stored naming-mode enum.** `prefix` present ⇔ managed; the node's `isEqualTo` dispatches on it.
- Byte-identity of planner ops is proven by target/adapter suites + `migration plan` e2e journeys — **not** `fixtures:check` (recurring trap; see the postgres-rls HANDOFF).
- Operator creates Linear tickets; never create them unprompted.

## Operating conventions

- Route work through the Drive process (`drive-process`): slice spec → slice plan → build loop. Write specs/plans yourself; delegate code to implementer subagents (Fable for implementers, Opus-4.8-mid for reviewers). Talk to the operator in plain text — no question-picker UI.
- Full CI gate set before calling a slice green: build, typecheck, whole Lint job (incl. `lint:deps`, `lint:framework-vocabulary`), `fixtures:check`, all three test suites.
- Commit/push as the `wmadden-electric` bot with the double sign-off; push via the `bot` remote (repo agent conventions).
- Fixtures and example contracts re-emit in slice 1 (storage hashes move — one sweep, expected).

## State at handoff

- Shaping artifacts written and pushed on a draft PR (branch `project/functional-indexes-shaping`).
- Slice-0 status confirmed and the substrate correction (two-node shape, above) folded into spec/plan/ADR on 2026-07-23.
- **Slice 1 built and in review** (2026-07-24): branch `slice/indexes-are-name-identified`, stacked on the shaping branch — five dispatches all reviewer-SATISFIED, full verification set green, 0.16-to-0.17 upgrade entries recorded for both audiences. Slice spec/plan under `specs/`/`plans/`.
- Next action: land the shaping PR, then the slice-1 PR; slice 2 (`expression-index-authoring`) follows per plan.md.
