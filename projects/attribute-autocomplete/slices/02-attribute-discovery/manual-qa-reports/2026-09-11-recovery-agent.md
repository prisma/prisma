# Manual QA report — Attribute discovery slice 02 — 2026-09-11

> **Script:** `projects/attribute-autocomplete/slices/02-attribute-discovery/manual-qa.md` (commit `bc8447079c` at run time; script itself uncommitted during this run)
> **Runner:** recovery-agent
> **Environment:** Linux, Node `v24.19.0`, pnpm `10.27.0`, branch `attribute-discovery`, commit `bc8447079c`
> **Started / finished:** 2026-09-11T09:55:01Z / 2026-09-11T09:55:20Z
> **Verdict:** ✅ Pass

## Summary

The supported language-server completion harness passed for provider and server paths, including configured SQL/Mongo factory-backed signatures and a contributed signature through an LSP request. Documentation was read directly and describes registry ownership, snippet/plain behavior, required-only insertion, optional-key discovery, and the non-recursive completion boundary. No GUI editor QA was performed or claimed; the run was limited to the supported in-repo LSP/Vitest harness plus source/documentation inspection.

## Findings

None.

## Per-scenario log

| # | Scenario | Isolation | Wallclock | Result | Findings |
| - | - | - | - | - | - |
| 1 | Exercise configured completion harness | workspace | ~4s | ✅ pass | — |
| 2 | Read completion documentation as a contributor | read-only | ~1s | ✅ pass | — |
| 3 | Exploratory: probe incomplete attribute text | workspace | ~3m source/harness inspection | ✅ pass | — |

## Scenario evidence

### Scenario 1 — Exercise configured completion harness

Command run from the repository root:

```text
pnpm --filter @internal/language-server test -- test/completion-provider.test.ts test/server.test.ts --reporter=dot
```

Observed output:

```text
> @internal/language-server@8.0.0-rc.9 test /Users/sevinf/projects/worktrees/prisma-next/attribute-autocomplete/prisma-next/packages/1-framework/3-tooling/language-server
> vitest run -- test/completion-provider.test.ts test/server.test.ts --reporter=dot

 RUN  v5.0.0-rc.2 /Users/sevinf/projects/worktrees/prisma-next/attribute-autocomplete/prisma-next/packages/1-framework/3-tooling/language-server

 Test Files  16 passed (16)
      Tests  303 passed (303)
   Start at  09:55:01
   Duration  3.80s (import 46%, tests 34%, transform 19%, worker 1%)
```

Relevant inspection evidence:

```text
packages/1-framework/3-tooling/language-server/test/completion-provider.test.ts:219: async function actualSqlStack(): Promise<CompletionTestStack> {
packages/1-framework/3-tooling/language-server/test/completion-provider.test.ts:235: async function actualMongoStack(): Promise<CompletionTestStack> {
packages/1-framework/3-tooling/language-server/test/completion-provider.test.ts:444: it('inserts required contributed attribute arguments as snippets for snippet clients', () => {
packages/1-framework/3-tooling/language-server/test/completion-provider.test.ts:482: it('preserves existing attribute delimiters and suffixes instead of inserting required arguments again', () => {
packages/1-framework/3-tooling/language-server/test/completion-provider.test.ts:551: expect(applyCompletionItem({ sourceFile: mapCompletion.sourceFile, item: mapItem })).toEqual(
packages/1-framework/3-tooling/language-server/test/completion-provider.test.ts:649: expect(applyCompletionItem({ sourceFile: mapCompletion.sourceFile, item: mapItem })).toEqual(
packages/1-framework/3-tooling/language-server/test/server.test.ts:862: it('returns configured required attribute argument snippets through server completion', async () => {
packages/1-framework/3-tooling/language-server/test/server.test.ts:882: expect(applyCompletionItem(completion.source, item)).toEqual(
```

Restore/status evidence after scenario:

```text
## attribute-discovery
 M drive/calibration/failure-modes.md
 M packages/1-framework/3-tooling/language-server/README.md
 M packages/1-framework/3-tooling/language-server/src/completion-provider.ts
 M packages/1-framework/3-tooling/language-server/test/completion-provider.test.ts
 M packages/1-framework/3-tooling/language-server/test/server.test.ts
?? projects/attribute-autocomplete/
```

The status contains expected implementation/docs/QA work plus the pre-existing user-modified `drive/calibration/failure-modes.md` and untracked project workspace.

### Scenario 2 — Read completion documentation as a contributor

Relevant observed README lines:

```text
README.md:15: The completion provider uses the configured project's scalar types, PSL block descriptors, symbol table, and interpretation context. Attribute completion therefore comes from the same authoring contributions that interpretation uses rather than from a language-server-owned list of SQL, Mongo, target, or extension attributes.
README.md:19: - Attribute names after `@` and `@@` for fields, models, and contributed PSL blocks.
README.md:20: - Top-level named argument keys inside an attribute call, excluding keys already supplied before the cursor.
README.md:21: - For clients that advertise LSP snippet support, attribute-name completions include only required positional arguments and required named arguments as empty editable tab stops. Optional arguments remain available through named-key completion instead of being inserted automatically.
README.md:22: - For clients without snippet support, attribute-name completions use plain-text edits with no snippet placeholders.
README.md:24: The provider preserves existing sigils, typed prefixes, completed attribute argument lists, and text after the cursor. It does not complete attribute values, recurse into record/list values, or offer nested function-call argument suggestions; those value-level completions are outside this package's current completion surface.
```

### Scenario 3 — Exploratory: probe incomplete attribute text

Inspected the new provider applied-edit assertions and focused harness coverage for these shapes:

- Partial contributed field attribute name before trailing comment: `@mar| // keep`.
- Plain-client fallback for the same contributed signature.
- Cursor inside an existing attribute-name suffix and argument list: `@mar|ker(name: "id") @unique`.
- Actual SQL field positional string attribute: `@ma| // keep` inserts `map("${1:}")` only for snippet clients.
- Actual SQL model required named key: `@@che| // keep` inserts `check(expression: "${1:}")` only for snippet clients.
- Actual Mongo field positional string attribute: `@ma| // keep` inserts `map("${1:}")` only for snippet clients.

No GUI/editor process was available in this environment, so no interactive editor acceptance, tab traversal, or rendering check was performed. The LSP text edits were applied in the harness and compared as source text.

## Coverage outcome

| AC ID | Scenario(s) | Result | Notes |
| - | - | - | - |
| AC-1 | 1, 3 | ✅ pass | Snippet/plain modes covered through provider and LSP server harnesses. |
| AC-2 | 1, 3 | ✅ pass | Applied-edit assertions cover trailing text, suffix/argument preservation, and actual configured signatures. |
| AC-3 | 2 | ✅ pass | README describes shipped behavior and explicit non-recursive limitation. |

## Disposition map

No findings.

## Suggested follow-ups

None from this QA run.
