# Dispatch plan — 04-lossless-json-projection-hard-cut

**Slice spec:** [`spec.md`](./spec.md)
**Linear:** [TML-3063](https://linear.app/prisma-company/issue/TML-3063/lossless-json-projection-hard-cut)
**Branch:** `tml-3063-lossless-json-projection-hard-cut`, stacked on `tml-3100-…` (PR #29830, draft, merge-coupled).

## Validation gate

Operator-confirmed 2026-07-29, with whole-slice autonomy (escalations: unpinned forks, unclassifiable expectation moves, live un-routed metaFor consumers, the pair-merge decision at DoD). Every dispatch runs this gate. The test filter is **derived from the diff at each run** — `git diff --name-only tml-3100-target-json-projection-implementations...HEAD` mapped to owning packages — plus the standing floor below; the slice-3 lesson is that a filter written before the work exists misses the package the work lands in.

```bash
pnpm build
pnpm typecheck
pnpm lint:deps
pnpm lint --filter <touched adapters/targets/extensions>
pnpm test --filter <every package the diff touches> --filter integration-tests
pnpm fixtures:check
pnpm check:upgrade-coverage
```

Standing floor regardless of diff: `integration-tests` (it owns `include-codecs.test.ts`, this slice's acceptance signal, and the #942-contract coverage that caught the seam), both adapters, both targets. The `projectJson` grep from slice 3 is **retired** — its invariant inverts here; the D1 byte-parity check below replaces it for the one dispatch that still needs dormancy. Failures classified individually, always; no-database packages are the free oracle for "is this real", but only against database contention — a 100 ms timeout under load is a different axis.

## Shape

Emission first (behavior-preserving, byte-parity evidence), then one renderer flip per target (each the observable cut for its target, carrying its own expectation moves and include-path evidence), then removal, then the breaking-change record. The judgment lives in D1–D3; D4–D5 are fan-out and documentation against settled decisions.

### Dispatch 1: ORM emits typed projection variants

- **Outcome:** `query-plan-select.ts` wraps JSON entries in `CodecJsonValueProjection` where the projected item carries a known `CodecRef`, `JsonDocumentProjection` where the value is already a JSON document (nested include objects, aggregated child rows), and `NativeJsonValueProjection` only for codec-less computed values. Rendered SQL is **byte-identical** — both renderers still render the variants identically, and a parity test proves it over representative plans (include, nested include, distinct, ranked/windowed paths — the sites at lines 1134/1236/1321/1388/1396 plus the `ProjectionItem.of(…, item.codec)` rewrite sites).
- **Builds on:** Slice 1's variant vocabulary; slice 3's per-codec knowledge that `item.codec` is already resolved at planning time.
- **Hands to:** An AST that states semantics the renderers can act on; the parity evidence that emission alone changed nothing.
- **Focus:** Emission and its parity proof only. No renderer, no expectation moves. The variant-selection rule (codec vs document vs native) is the one judgment here — state it once at a named site, since both flip dispatches and slice 5 will read it.

### Dispatch 2: PostgreSQL renderer flip

- **Outcome:** The PG visitor's `codec` case resolves the descriptor from the validated registry and renders `projectJson(value, ref)` — scalar or array lift per `ref.many`; `document` stays identity (PostgreSQL preserves JSON subtype). Every e2e/integration expectation that moves is classified (mechanical form-change vs corrected old defect, the D2 discipline). Include-path conformance lands for the PG members of the seven-codec class: numeric, int8, bytea, interval, vector — including the two project-DoD numeric values through a real ORM include. `include-codecs.test.ts`'s PG assertions go green.
- **Builds on:** D1's typed emission; slice 3's database-proven projections; slice 2's validated registry already injected into the renderer (`codecDescriptorRegistry` is in `ParamIndexMap`).
- **Hands to:** Canonical database-produced JSON on PostgreSQL; the evidence pattern D3 mirrors.
- **Focus:** One target's cut, whole. If a projection produces SQL the parity of which disagrees with slice 3's harness evidence, that is a finding against the harness's flat-object limit — surface it, don't patch it silently.

### Dispatch 3: SQLite renderer flip with document retagging

- **Outcome:** The SQLite visitor's `codec` case renders `projectJson` via the registry; `document` applies `jsonDocumentRetag` at the outermost consumed boundary (D6's named seam, its collapse property making placement safe). SQLite include-path conformance for bigint/blob/json; expectation moves classified. The retag's throws-on-non-JSON-text edge is asserted against the visitor's actual reachable inputs, not inherited from D6's reasoning.
- **Builds on:** D1's emission; D6's mechanism and probe record; D2's evidence pattern.
- **Hands to:** Canonical database-produced JSON on both targets — the cut complete.
- **Focus:** One target's cut, whole, including the retag judgment D6 deliberately left to this seam.

### Dispatch 4: Remove the generic metadata channel

- **Outcome:** `CodecMeta`, descriptor `meta`/`metaFor`, and lookup `metaFor` are gone — 33 sites in 9 production files (framework codec surfaces ×4, `psl-column-resolution.ts`, `relational-core/codec-types.ts`, both targets' descriptor bases and PG codecs), plus every test that pinned them. Before deleting, the dispatch **enumerates consumers by grep** (the seam lesson: consumers, not callers-in-the-diff) and confirms each is either dead or already descriptor-routed. `pnpm fixtures:check` attributes any artifact movement; emitted contracts should not move (meta never reached `contract.json`) — verify rather than assume.
- **Builds on:** D2/D3 — after the flips, nothing renders from meta.
- **Hands to:** A codec surface with one source of target truth: the descriptors.
- **Focus:** Deletion with enumeration evidence. Any consumer that turns out live and un-routed is a halt, not an inline migration.

### Dispatch 5: The breaking-change record and the guarantee wording

- **Outcome:** Upgrade instructions cover the flip (database-produced JSON changes form for the affected codecs — enumerate from the *codecs that moved*, not the diff, per the D9 lesson); the canonical-JSON guarantee is stated in docs with both limits (`pg/geometry@1` exempt → TML-3105; floats at `extra_float_digits >= 1`) — **a reviewable artifact, reviewed as one**; ADR 155's stale int8-identity passage and the codec authoring guide's transition language ("production renderers do not yet call `projectJson()`") are corrected; both PR descriptions state the merge sequence **and name the distinctness test as the retired grep's successor** — the one thing a reviewer runs to believe the cut is live (reviewer item, D1 R1/D2 R1: the grep was load-bearing for three slices and reviewers will look for its replacement).
- **Builds on:** Everything prior; the slice-3 upgrade entries this extends.
- **Hands to:** Slice close — reviewer verdict, then the stacked-pair merge conversation with the operator.
- **Focus:** The record. `check:upgrade-coverage` green is necessary but not sufficient — the gate fires on paths, not surfaces; enumerate from the codec list.

## Open items

- **Open question 2 (generic float finiteness)**: resolve during D2 grounding; if `sql/float@1`-family lacks the `sqlite/real@1` treatment, it is a small D2 add; if covered, record and drop.
- **Aggregate divergence noted at PR review** (`count()` types `bigint`, runtime returns `'2'`): TML-3064's, explicitly not this slice's — resist the temptation in D2, where it will be visible.

- **Slice-5 trap, from D3 review:** the `decodeJson(null)` guard lives in the runtime (`collection-dispatch` short-circuits null at three shapes), **not** at the codec boundary. A public testkit calling `decodeJson` directly over harness cases has no such short-circuit, so a null case routed through it meets codec strictness and throws. Not a defect anywhere today; a trap for the one dispatch that calls these methods from outside the runtime. Belongs in TML-3064's brief.

## Hand-off linearity

D2 and D3 both build on D1 directly and are independent of each other; D4 needs both flips; D5 needs everything. The non-linear edge worth naming: D3's retag work reads D6's probe record in *slice 3's* spec, not anything D2 produces.

## Completeness against slice-DoD

Include-path coverage and the DoD numeric values — D2/D3. The metadata grep — D4. The inverted `projectJson` expectation — D2/D3 make production paths reach it; D4's grep confirms nothing else does. PR-pair statements and guarantee wording — D5. `include-codecs.test.ts` green — D2 (PG assertions) and D3 (if it carries SQLite arms).
