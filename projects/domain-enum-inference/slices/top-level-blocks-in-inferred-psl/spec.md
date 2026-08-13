# Slice 1 — `top-level-blocks-in-inferred-psl` — Spec

**Project:** [`../../spec.md`](../../spec.md) · **Plan:** [`../../plan.md`](../../plan.md)

## Purpose

Two prerequisites for domain-enum recovery, neither of which emits an enum:

1. `contract infer` can put a PSL block at top level *and* keep a namespace-wrapped block in the same document.
2. The reprint corpus every later harvest reads from is captured against a real database, not guessed.

## Why this is not a document-shape change

`buildPslDocumentAst` builds exactly one namespace (`infer-psl-contract.ts:320-337`), named either the introspected schema or `UNSPECIFIED_PSL_NAMESPACE_ID`, and puts every model and every extension block in it. That single bucket is the whole limitation.

Everything downstream already supports two:

- `PslDocumentAst.namespaces` is `readonly PslNamespace[]` (`psl-ast.ts:313-319`).
- `UNSPECIFIED_PSL_NAMESPACE_ID` (`psl-ast.ts:197`) names the flat bucket.
- The print-document builder sorts that bucket first (`ast-to-print-document.ts:65-66`).
- The serializer prints its contents with no wrapper, explicitly so top-level declarations round-trip to top-level output (`serialize-print-document.ts:94-99`).

So this slice teaches one function to emit two buckets and proves the seam end to end. No change to `PslDocumentAst`, `makePslNamespace`, `makePslNamespaceEntries`, or the printer.

## Scope

**In:**

- `buildPslDocumentAst` emits a second `PslNamespace` named `UNSPECIFIED_PSL_NAMESPACE_ID` when there is top-level content, alongside the named one, and continues to emit exactly one bucket when there is not. Existing byte-level output for every current input must be unchanged — the flat bucket appears only when something is put in it, and nothing is put in it yet by this slice.
- A seam test proving a two-bucket document prints as top-level declarations followed by `namespace <schema> { … }`, and that the result re-parses and re-interprets. Constructing the document directly in the test is acceptable and preferable to inventing a fake producer.
- The reprint corpus, captured against a real database as an integration test that creates each shape and asserts the introspected body verbatim. **Capture on the supported floor.** [ADR 244 — PostgreSQL floor lowered to 15](../../../../docs/architecture%20docs/adrs/ADR%20244%20-%20PostgreSQL%20floor%20lowered%20to%2015.md) sets the minimum at 15 and the test image is `postgres:15-alpine`, so 15 is what the corpus must record. Postgres's predicate printer is version-dependent; a literal captured on 17 is not evidence about a supported 15 deployment. If any shape's reprint differs between 15 and the newest version CI exercises, that difference is itself a finding the harvest design must accommodate — report it rather than picking one:
  - `text` scalar, one member
  - `text` scalar, two or more members — **the missing entry; no literal for this exists anywhere in the tree**
  - `varchar(n)` scalar, one member
  - `varchar(n)` scalar, two or more members
  - `text[]` enum-array (`<@ ARRAY[…]`)
- Replace the two hand-written `varchar` single-member fixtures with the captured output if it differs: `packages/2-sql/9-family/test/schema-verify.verdict.test.ts:791` and `packages/2-sql/1-core/schema-ir/test/sql-check-constraint-ir.test.ts:67`. Both are drift fixtures whose bodies were written by hand and are suspected wrong (a one-element `IN` likely collapses to `=`, not `= ANY (ARRAY[…])`). If the captured output differs, the fixtures are wrong and change; if it matches, say so and leave them.

**Out:**

- Emitting any enum block, recovering any value set, harvesting any literal. Slices 2 and 3.
- Touching the multi-namespace hard failure at `infer-psl-contract.ts:164-182`. That error fires when *content* spans multiple schemas; this slice adds a bucket for schema-less top-level declarations, which is orthogonal. Leave it exactly as it is, including its message.

## Definition of Done

- `contract infer` output is byte-identical to today for every existing test input. This is the slice's main risk and its main assertion: the flat bucket must be invisible until something occupies it.
- A document carrying both buckets prints top-level blocks before the namespace block, and the printed text re-parses and re-interprets without diagnostics.
- Each reprint shape above is pinned by an assertion on output captured from a live database, with a comment naming it as observed rather than authored.
- The two suspect `varchar` fixtures are either corrected against captured output or confirmed accurate, with the finding stated.
- Team DoD floor: `pnpm -w build`, `pnpm typecheck`, per-package `lint`, `pnpm lint:deps`, `pnpm fixtures:check`, the cast ratchet, and `check:upgrade-coverage`.

## Notes for the implementer

- The comment at `infer-psl-contract.ts:316-319` describes the current single-bucket behaviour and will need rewriting rather than extending.
- `enum-check-constraint.integration.test.ts:191-195` creates a two-member text membership check but deliberately asserts only substring membership, with a comment explaining why. That is the test to extend with the exact literal — the substring assertion can stay beside it.
- The corpus belongs where the existing reprint assertions live: `packages/3-targets/6-adapters/postgres/test/migrations/check-introspection.integration.test.ts`, whose header already states that every literal in it is observed output.
