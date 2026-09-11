# Manual QA — Attribute discovery slice 02

> **Be the PSL author or attribute contributor.** Drive the language-server completion surface through its documented LSP harness and read the package documentation for the supported boundary.
>
> **Out of scope of this script.** Do not claim GUI/editor actions were performed. Do not re-run the full CI suite as manual QA. Do not test recursive attribute values, record/list member discovery, or nested function-call arguments; those are explicitly outside this slice.
>
> **Spec:** `projects/attribute-autocomplete/slices/02-attribute-discovery/spec.md`
> **Plan:** `projects/attribute-autocomplete/slices/02-attribute-discovery/plan.md`
> **Brief:** `projects/attribute-autocomplete/slices/02-attribute-discovery/dispatches/02-required-argument-insertion.md`
> **PR:** N/A before PR creation

## Table of contents

| # | Scenario | What it proves | Isolation | Covers |
| - | - | - | - | - |
| 1 | Exercise configured completion harness | LSP requests return registry-backed names, keys, and required-only snippets for snippet clients while plain clients stay plain | workspace | AC-1, AC-2 |
| 2 | Read completion documentation as a contributor | The non-ADR docs describe configured registry ownership, snippet/plain behavior, optional omission, and the non-recursive boundary | read-only | AC-3 |
| 3 | Exploratory: probe incomplete attribute text | Probe nearby cursor shapes for duplicated delimiters, clobbered suffixes, or invented values beyond the scripted harness cases | workspace | AC-1, AC-2 |

> Scenarios marked **workspace** run in an isolated git worktree when the runner follows full `drive-qa-run` parallel isolation. In this local implementation pass, the runner may execute the supported harness in the current checkout only if it records the checkout state before and after and does not mutate source.

## Acceptance criteria

| AC ID | Claim |
| - | - |
| AC-1 | Snippet-capable clients receive required positional and named argument slots only, with empty editable values and no invented literals; plain clients receive ordinary edits without snippet syntax. |
| AC-2 | Applied completion edits preserve typed prefixes, existing delimiters/arguments, and text after the cursor for configured and contributed attribute signatures. |
| AC-3 | Current non-ADR docs describe names, keys, required insertion, snippet/plain modes, configured/contributed registry ownership, and explicitly do not claim recursive value completion. |

## Pre-flight

1. Record the current commit and branch: `git rev-parse --short HEAD && git branch --show-current`.
2. Record Node and pnpm versions: `node -v && pnpm -v`.
3. Record current checkout dirtiness with `git status --short --branch`. Existing unrelated local changes are acceptable only if they are explicitly named and not touched by the QA run.

## Scenario 1 — Exercise configured completion harness

**What you're proving from the user's seat:** A snippet-capable LSP client and a plain LSP client receive the advertised completion edits through the same provider/server path a configured PSL document uses, rather than a copied list of attribute names.

**Covers:** AC-1, AC-2

**Isolation:** `workspace`

**Oracle:** The slice spec says attribute completion must use the configured registry/spec/context path, insert required positional and named arguments only for snippet clients, keep optional arguments as key completions, and preserve existing text around the cursor.

**Preconditions:**

- Run from the repository root.
- No GUI editor is required; the supported harness is the language-server Vitest request harness that opens configured PSL documents and applies returned LSP text edits.

### Steps

1. Run `pnpm --filter @internal/language-server test -- test/completion-provider.test.ts test/server.test.ts --reporter=dot`.
2. Inspect the result line and confirm the focused provider/server files passed.
3. Inspect the source snippets in `packages/1-framework/3-tooling/language-server/test/completion-provider.test.ts` and `packages/1-framework/3-tooling/language-server/test/server.test.ts` for applied-edit assertions, not only completion item shape assertions.

### What you should see

- The focused provider/server completion harness exits 0.
- The provider tests cover actual SQL and Mongo stacks loaded from their configured family factories, plus contributed fixture signatures.
- The server test covers a configured contributed signature over an LSP completion request with snippet support.
- Applied-edit assertions include trailing text after the cursor and an existing argument-list/suffix case.

### Failure modes

- The command exits non-zero.
- Snippet completions include optional arguments, concrete literal values, or recursive nested value/function arguments.
- Plain completions contain snippet placeholders.
- Applied-edit checks are absent or only inspect item labels/shapes.

### Restore

Run `git status --short --branch` and confirm no files changed because of this scenario.

## Scenario 2 — Read completion documentation as a contributor

**What you're proving from the user's seat:** A contributor reading the package docs can tell what this slice ships and what it intentionally does not ship, without reading implementation internals or ADRs.

**Covers:** AC-3

**Isolation:** `read-only`

**Oracle:** The brief requires current non-ADR language-server documentation and forbids claiming recursive value/function-argument suggestions.

**Preconditions:**

- Run from the repository root.

### Steps

1. Read `packages/1-framework/3-tooling/language-server/README.md`.
2. Confirm it names the configured project registry/context as the source of attribute names/signatures.
3. Confirm it describes snippet-capable vs plain clients.
4. Confirm it states optional arguments are not inserted automatically and recursive values/nested function-call arguments are out of scope.

### What you should see

- The README documents supported attribute-name and top-level named-key completion.
- The README describes required-only snippet insertion with empty editable tab stops.
- The README explicitly limits value-level recursion and nested function-call argument completion.

### Failure modes

- The docs imply hardcoded family/target attributes.
- The docs claim recursive value completion or nested function-call argument completion.
- The docs omit either snippet clients or plain clients.

## Scenario 3 — Exploratory: probe incomplete attribute text

**Charter.** Explore incomplete attribute-name positions around existing suffixes, parentheses, comments, and text after the cursor using the focused completion harness and source review. Discover surprising edit shapes, duplicated delimiters, or invented values the scripted tests did not name.

**Covers:** AC-1, AC-2

**Isolation:** `workspace`

**Time budget:** 10 minutes.

**Notes capture:** Record what combinations were inspected, whether they were covered by automated harness assertions, and any cases that felt underspecified. Do not perform GUI/editor actions unless an actual editor integration is available; if not, state that limitation in the report.

## Scenarios deliberately not in this script

| AC | Why it's not a manual-QA scenario |
| - | - |
| Full language-server typecheck/lint/build gates | These are CI/dispatch gates, not manual-QA judgement; the dispatch report records their exact exits separately. |
| Workspace package suite | This is a dispatch gate with known packaging flakes, not a manual QA scenario. |
| Recursive value completion | Out of scope for slice 02 dispatch 2 and explicitly deferred to a later slice. |

## Sign-off coverage map

| AC ID | Scenario(s) covering it |
| - | - |
| AC-1 | 1, 3 |
| AC-2 | 1, 3 |
| AC-3 | 2 |
