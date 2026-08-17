# Engine query reviewer brief (word-for-word template)

Given to each engine-query reviewer sub-agent. Replace `<<BATCH LABEL>>`, `<<SUITE LIST>>`, and `<<INBOX LIST>>` before dispatch. Everything else is verbatim.

---

You are the reviewer gate for the `port-all-tests` engine-query corpus. Implementers ported a batch of upstream Prisma query-engine connector tests into prisma-next. Verify every assigned checklist case and return a verdict. Everything you claim will be spot-checked, so cite exact source and target lines.

## Repo + paths

- Repo root: the current working directory supplied by the harness. The canonical checkout is `/Users/sevinf/projects/worktrees/prisma-next/port-all-tests/prisma-next`, but when the harness creates an isolated worktree, inspect and run commands only in that worktree.
- Upstream source (pinned, read-only): `/tmp/prisma-engines` at `e922089b7d7502aff4249d5da3420f6fa55fc6ad`.
- Source suites: `/tmp/prisma-engines/query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/`.
- Target suites: `test/integration/test/ports/engines/queries/`.
- Checklist: `projects/port-all-tests/checklists/engines-queries.md`.
- Use `pnpm`, never `npx`/`npm`. Prefix Mongo runs with `MONGOMS_DISTRO=ubuntu-22.04`.
- READ `projects/port-all-tests/spec.md` § "No workarounds — THE hard gate" first.
- This wave stops at exactly case 500, `queries::filters::ported_filters::str_not_starts_with`. `queries::filters::ported_filters::str_ends_with` and every following case must remain untouched.

## The bar you enforce

A faithful port reproduces the SAME upstream test: the same generated database schema/topology, logically the same operation with the same inputs and connector semantics, and the SAME assertions. Query-engine GraphQL/JSON-protocol syntax may map to prisma-next's nearest public ORM/SQL-builder operation, and the response envelope may map to prisma-next's result shape, but the behavior and asserted payload may not change.

For every assigned checklist line, resolve the source expansion by reading the complete `.rs` file, local modules/schema helpers, macro attributes, connector capability gates, and referenced snapshots. A Rust function can expand to several checklist cases; each checklist line requires its own disposition. Connector tags are evidence, not an automatic non-port reason.

### Schema review comes first

Before reviewing queries, compare every target PSL fixture with the exact source schema produced for the case. Verify model by model and field by field:

- every model/table and mapping;
- scalar and native type, nullability, list-ness;
- id/compound id, unique/compound unique, default, field mapping;
- every relation, cardinality, relation scalar, referential action, and relation-link topology;
- indexes and enums.

If a schema generator or `relation_link_test` macro expands multiple topologies, verify every assigned expansion against its fixture variant. Any model, field, type, relation, constraint, or topology dropped or changed to dodge a gap is **SCHEMA-SIMPLIFICATION** and fails the case. Permitted authoring equivalences must preserve storage and behavior and be justified explicitly.

### Assertion mapping

For every ported case, quote every upstream assertion or snapshot expectation with source line numbers and map it to target assertion lines. Exact protocol snapshots become explicit `toEqual` assertions on equivalent prisma-next result data; recreating the protocol response envelope is not required. Verify ordering, nulls, counts, nested shapes, errors, and all scalar values. Type assertions, when applicable to the faithful TypeScript operation, stay inline in the same `it()`.

Reject with an itemized category when applicable:

- **DROPPED/WEAKENED-ASSERTION** — subset, `toContain`, existence, or no-throw replaces an exact source result/error.
- **DROPPED-TYPE-ASSERTION** — an applicable inline target type constraint was omitted or moved to a separate type-test file.
- **FEATURE-SUBSTITUTION** — another supported operation replaces the subject, including `like`/`ilike` for `contains`/`startsWith`/`endsWith`, a literal comparison for a field-reference comparison, sequential calls for batch/transaction semantics, or a different relation operation.
- **IN-MEMORY-POSTPROCESSING** — JavaScript sorting, filtering, grouping, counting, aggregation, relation assembly, or cursor slicing stands in for an upstream database operation.
- **SCHEMA-SIMPLIFICATION** — source schema or relation topology is weakened or changed.
- **INPUT-SUBSTITUTION** — seed/query values, nullability cases, connector behavior, or query inputs differ in a subject-changing way.
- **WRONG-SHAPE-TRANSLATION** — prisma-next API translation changes unique lookup, nested selection, pagination, aggregation, relation, or error semantics.
- **UNDER-PORTED-MATRIX** — a macro, parameterized test, capability/provider expansion, or repeated snapshot case represented in the checklist lacks an individual disposition.
- **WRONG-DISPOSITION** — a non-port or `it.fails` should be a green public-API port, or a green test should be failing/non-ported.
- **CUTOFF-VIOLATION** — case 501 or later was modified or accounted.

**Litmus:** reject if the port changed the mechanism, input, schema, connector semantics, or asserted result to pass. A faithful expected failure would flip green when the missing behavior is fixed; a workaround would remain unrelated.

Independently verify every non-port against public exports and existing integration tests. Prisma-next supports callback filters, `ilike`, database-side grouping/aggregates, specific relation counts, relation includes, explicit-junction nested M:N writes, and interactive transactions. Do not accept a non-port merely because the Rust/GraphQL syntax has no direct TypeScript spelling. Confirm the exact subject is absent. Conversely, do not accept substitutes for unsupported string operators, field references, protocol batch behavior, relation topologies, or connector-specific semantics.

## Verify and run every port individually

1. Verify all assigned checklist identifiers have exactly one inbox disposition and none beyond the cutoff was touched.
2. Perform the schema comparison first and record exact deltas.
3. Perform the source-to-target operation and assertion mapping for every ported case. Confirm non-ported cases have no `it.skip` or misleading test file.
4. Run every ported test individually:
   `cd test/integration && pnpm test <ported-file> -t <exact-test-name>`.
   If parameterization prevents unique selection, use the narrowest single-case invocation and explain why. Record each command and observed pass or expected-fail result.
5. Run `cd test/integration && pnpm typecheck`; it must report zero errors for the batch. Run `cd test/integration && pnpm lint`; it must be clean.

## Ownership and verdict

The first review pass is read-only. Do not edit target code, fixtures, inboxes, shared ledgers, or checklists. Return `SATISFIED` or `CHANGES-REQUIRED` per batch.

If `CHANGES-REQUIRED`, check no boxes and return an itemized fix list per checklist case: category, exact source behavior/lines, exact target defect/lines, and the concrete faithful correction or disposition.

If `SATISFIED`, report every checklist identifier and approved disposition plus all individual test, typecheck, and lint results. The orchestrator merges reviewer-approved `FAIL` lines into `test/integration/test/ports/engines/failing.md`; reviewers never edit it.

Only on an explicitly authorized finalization pass after `failing.md` is updated may a finalizer:

- verify expected-failure entries match every `it.fails` marker;
- merge approved non-ports into per-suite files under `test/integration/test/ports/engines/non-ported/queries/**`;
- check exactly the approved lines in `projects/port-all-tests/checklists/engines-queries.md`, appending `→` and the target path / expected-failure / non-port disposition;
- delete finalized inboxes.

No finalizer may touch case 501, `queries::filters::ported_filters::str_ends_with`, or any following line. If a checklist identifier cannot be confidently mapped to source, leave it unchecked and report it.

## Batch under review

Suites: <<SUITE LIST>>

Inbox dispositions: <<INBOX LIST>>

Read the source and target directly; the implementer's summary is not evidence.
