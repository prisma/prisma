# How we can tell it's correct

The release bar is "everything we ship works." This document is about making that a checkable statement instead of a feeling. The principle throughout: **every claim in the announcement has a receipt** — a test suite, a fixture, or a published measurement that anyone can look at.

## The feature-support matrix

The centerpiece. A table with one row per feature and one column per database (Postgres, SQLite, MongoDB). Every cell holds one of three verdicts:

- **Works** — and the cell names the test suite that proves it. A "works" without a green suite behind it is not allowed on the board.
- **Experimental** — shipped, usable, explicitly outside the stability promise.
- **Not in 8.0** — a deliberate, written-down absence.

### Where the rows come from

You cannot name what's missing by looking only at what you built. So the row list is built by crossing two enumerations:

1. **What v8 actually exposes**, read out of the codebase: the exports of the per-database packages, the CLI's command tree, the PSL schema-language feature set, the query and ORM operations, the migration operations, and the extensions. If a capability isn't reachable through the supported public surface, it isn't a row.
2. **What Prisma 7 users will look for**, read out of Prisma 7's documentation structure and its functional test suite (which is effectively a census of every feature P7 ever supported): relation kinds, JSON operations, full-text search, views, multi-schema, raw queries, transaction variants, and so on. This list is what forces every absence to be named instead of silently missing.

### What the matrix produces

Three things, from one artifact:

- **The public dashboard.** The matrix is checked into the repository as structured data and rendered by CI as a page of ticks and crosses. There is no separate progress dashboard: cells flipping from cross to tick as their proving suites go green *is* the progress display, both for us before the RC and for the public after it. Ticks link to the proving suite; deliberate crosses become the "not in 8.0" list and, after the RC, link to gap-tracking issues.
- **The to-do list.** Every cell we believe works but that no current test proves is, by definition, missing test coverage. That list of unproven cells is the work queue for the test-porting effort below.
- **The announcement's supported-surface section**, generated rather than hand-written.

### Timing

Enumerating rows and drafting verdicts needs no decisions and starts immediately. Final verdicts are stamped at the July 24 checkpoint, after the minimum-Postgres-version decision (July 22) and the polymorphism stable-or-experimental call (July 24).

## The side-by-side proof

The single biggest claim in the release is that v7 and v8 run together in one project against one database so users can migrate incrementally. **Nobody has ever actually run this setup** — the evaluation that was planned for it never happened. So we build it as an end-to-end test fixture: both versions installed in one project, one Postgres database, v7 continuing to run its migrations while v8 adopts the same database and queries it, including the routine of re-adopting after v7 changes the schema.

This fixture must be green by July 24. If it isn't, the parallel-install claim in the announcement gets softened — that trade is decided at the checkpoint, not discovered after launch. Details of what it exercises are in [parallel-install.md](parallel-install.md).

## Mining Prisma 7's tests

Prisma 7's functional test suite encodes years of accumulated database and query edge cases — that accumulated knowledge is the valuable artifact, not the test code itself, which is written against a different API and would take months to convert wholesale. So instead of converting it, we mine it: extract the cases that cover features our matrix claims work but that no current v8 test proves (the unproven-cell list above), and port just those. Where checking against v7's behavior is cheaper than porting assertions, the side-by-side fixture doubles as the comparison harness: run the same scenario through both versions and compare results, with v7 as the reference.

With EA adoption having been thin, this suite does the confidence-building work that production feedback would normally do.

## Benchmarks

**TypeScript compile-time performance** is measured before the type freeze, not after — v8's types lean heavily on conditional types, which is exactly the pattern that can make type-checking slow on large schemas, and if the numbers are bad, the types can only be fixed while they're still allowed to change. The benchmark generates schemas of 10, 100, and 500 models, measures `tsc` check time, type-instantiation counts, and memory, on both TypeScript 5.9 and TypeScript 7, and publishes every run to a public Bencher dashboard. Pull requests fail if they increase instantiation counts (chosen as the merge-blocking metric because it's deterministic; wall-clock time on shared CI runners is too noisy to block on and is tracked as a trend instead).

**Runtime performance** comparisons against v7 are already published, with graphs. Two follow-ups: before tagging the RC, the suite is re-run manually to confirm the published numbers still hold — having published the claim, the one unshippable thing is an RC that quietly walks it back. After the RC, the suite gets a day of engineering to run reliably in CI on a nightly schedule (nightly rather than per-PR: runtime benchmarks on shared runners are too flaky to block merges on, and a nightly trend with alerts gives the regression protection without ever blocking anyone).

## The checkpoint

July 24 is the day all of this converges. Three calls get made, in writing: polymorphism ships stable or experimental (decided by whether new bugs have stopped appearing); the matrix verdicts freeze; and the side-by-side fixture is green or the coexistence claim is cut down to what's actually proven. After July 24, everything remaining is mechanical.
