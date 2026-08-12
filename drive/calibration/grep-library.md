# Grep library

Patterns that catch known anti-patterns. Run as part of dispatch DoD for any dispatch whose work is in the affected surface area. New entries land here when a retro surfaces an anti-pattern that a grep pattern can detect (see [`README.md § Maintenance discipline`](./README.md#maintenance-discipline)).

Each pattern is sibling to a [`failure-modes.md`](./failure-modes.md) entry that explains *why* the pattern matters — patterns here are the **detection**, failure modes are the **diagnosis + mitigation**.

## IR substrate hygiene

```bash
# Optional fields on substrate IR classes that should be required:
rg 'namespaceId\?:' packages/

# Constructor / consumer normalisation magic:
rg '\.namespaceId\s*\?\?' packages/

# Dual-shape support function names (any future ones — add as discovered):
rg 'looksLikeFlat|normalizeStorageForHydration|stampNamespaceOnTable|normalizeStorageEnvelopeShape|isFlatTablesInput|isFlatTypesInput' packages/

# Discriminator probes for the IR storage shape:
rg "'columns' in" packages/

# Deleted helpers that should not return:
rg 'foreignKeyNamespacesMatch' packages/
```

## Test-literal hygiene

```bash
# Flat-shape literals in test fixtures (after canonical shape is the only allowed shape):
rg 'tables:\s*\{\s*[a-z][A-Za-z_]+\s*:' packages/ -g '*.test.ts' -g '*.test-d.ts' -g 'fixtures/*.ts' | rg -v '__unbound__|public|auth|tenant'
```

## Contract-cast hygiene

```bash
# Descriptor contractSpace.contractJson → Contract casts — forbidden anywhere:
# ControlExtensionDescriptor declares contractSpace: ContractSpace (typed contractJson),
# so every consumer — including ControlStack's extensionContracts assembly — property-picks;
# no narrowing cast is sanctioned anymore. -U catches multi-line casts.
# Form 1: reach-through (blindCast<...>(x.contractSpace.contractJson)):
rg -U 'blindCast<[^(]*\([^)]*contractSpace!?\??\.contractJson' packages/
# Form 2: picked-variable — a contractJson variable assigned from a contractSpace
# (plain or destructured), cast within the next ~400 chars. The provenance tie
# keeps API-boundary casts of unrelated contractJson values (e.g. a query-builder
# accepting user-supplied contract JSON) from false-positiving — those are
# separate boundaries, not this anti-pattern.
rg -U 'contractJson[^\n=]*=[^\n]*contractSpace(?s:.){0,400}?blindCast<[^(]*\(\s*contractJson\s*\)' packages/
```

## Cross-cutting anti-patterns

```bash
# Transient project artefact references in long-lived docs:
# (See AGENTS.md / .cursor/rules/doc-maintenance.mdc for the canonical pattern.)
rg 'Project [12]|\bD[1-9]\b|\(FR[0-9]+\)|\(T[0-9]+\)|AC-[A-Z][A-Z0-9-]*|\bR[0-9]+B?\b|\bF[1-7]\b|\bM[12]\b|per spec|the spec\b|spec calls|spec wording|spec promises|sub-spec|milestone' -- ':!projects/' ':!*.generated.*'

# File-extension imports in TS (forbidden):
rg "from '[^']+\.(ts|tsx|js|jsx)'" packages/

# any type usage (forbidden):
rg ': any\b|\bany\[\]' packages/ -g '*.ts' -g '*.tsx'

# @ts-expect-error outside negative type tests:
rg '@ts-expect-error' packages/ -g '*.ts' -g '!*.test-d.ts'

# @ts-nocheck (forbidden):
rg '@ts-nocheck' packages/
```

## Docs claim-scrub (F12)

When asked to remove / correct a claim across docs, scrub exhaustively: grep every phrasing of the claim, correct each hit, then re-grep until the residual is empty. The pattern is claim-specific; the discipline is not. Worked example (the "tolerant classifier reuses `MigrationGraph`" claim):

```bash
# Enumerate every phrasing, then re-run after correcting until empty:
rg -in "reuse|mirror|model|adjacency|detectCycles" projects/<project>/*.md
```

The closing re-grep belongs in the dispatch DoD for any docs-correction task.

## When to extend the library

- A failure mode is detected by a pattern not already here.
- An anti-pattern slips past `pnpm lint:deps` or the type system but is caught by ad-hoc grep.
- A corrective round introduces a new "must-not-return" pattern.

Mark entries as historical (don't delete) when the underlying anti-pattern is structurally impossible (e.g. removed at the type level by a substrate change).
