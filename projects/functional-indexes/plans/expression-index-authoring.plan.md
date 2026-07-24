# Plan — Slice 2: `expression-index-authoring`

**Spec:** [expression-index-authoring.spec.md](../specs/expression-index-authoring.spec.md). Branch `slice/expression-index-authoring`, stacked on `slice/indexes-are-name-identified`. Same loop conventions as slice 1; the standing gate now includes `lint:throws`, `test:examples`, and `check:upgrade-coverage --mode pr` from round 1.

## Dispatch sequence

### 1 — Shared lowering carries the full matrix

**Outcome:** `AuthoredIndexInput`/`lowerAuthoredIndex` accept `expression`/`where`/`unique` (threaded into node + hash tuple); the three cross-field guards are user-facing `contractError`s (columns-xor-expression, expression-requires-name-or-map, map-xor-name); the D9 warning emits from the shared path via the `contract-warnings.ts` mechanism (`PN_EXACT_NAME_BODY_COMPARISON`, exact spec wording, fields-only `map:` silent); `IndexNode` carries the new fields. No authoring surface exposes them yet — everything reachable today behaves identically (fixtures unmoved, zero fixture movement).

**Builds on:** slice-1 substrate. **Hands to:** a complete, warning-capable lowering both surfaces can feed.

### 2 — Both authoring surfaces + diagnostics

**Outcome:** PSL `@@index` accepts the matrix with optional `fields`, the three span-anchored diagnostics exist with their exact codes (via the contributed-code seam: `leafDiagnostic` optional code param, family-neutral widening of `PslDiagnostic.code`, codes defined in `contract-psl`), and the interpreter threads the fields; TS `constraints.index` gains the expression overload + `map`/`where`/`unique` options and `contract-lowering` threads them; SQLite target rejects expression/where at lowering with a clear error; PSL/TS parity test pins identical IR for matrix inputs; `@@unique`/`constraints.unique` byte-unchanged. Stop-condition: the framework type change spreading beyond `psl-ast.ts` + `diagnostic.ts`, or `lint:framework-vocabulary` red.

**Builds on:** dispatch 1's lowering. **Hands to:** the ciphers index authorable on both surfaces.

### 3 — Scenario rows + ciphers e2e + docs

**Outcome:** DoD-1 e2e rewritten to PSL + TS authored fixtures (factory fixture deleted); scenario-row tests B, D, E, G, H green as named in the spec; authoring docs updated; upgrade-skill entries for the new surface recorded; full gate green including the four late-discovered commands.

**Builds on:** dispatches 1–2. **Hands to:** slice-DoD met; PR-open (stacked on slice 1).

## Sizing notes

Three dispatches: substrate-side threading (small, invisible), the two surfaces with their diagnostic mechanism (the judgment core), and acceptance. The diagnostic-seam framework touch is deliberately isolated inside dispatch 2 with an explicit stop-condition.
