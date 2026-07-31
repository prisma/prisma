# Slice: 04-lossless-json-projection-hard-cut

_Parent project: `projects/codec-json-projections/`. Outcome: database-produced JSON is canonical and lossless on every codec-aware path — the projections slice 3 authored are switched on, the generic metadata channel is removed, and PR #29830 unblocks._

## At a glance

The ORM emits typed projection variants instead of blanket `NativeJsonValueProjection`; both renderers' `JsonValueProjectionVisitor`s stop rendering the three variants identically and route `codec` through `descriptor.projectJson()` (SQLite's `document` case through `jsonDocumentRetag`); `CodecMeta`/`meta`/`metaFor` disappear; fixtures and expectations move to canonical forms. The include path — whose strict `decodeJson` currently fails against native producers, the reason #29830 is draft — becomes coherent: `include-codecs.test.ts` going green is this slice's acceptance signal.

## Chosen design

### The flip is three dormant seams, each built earlier and named in the artifacts

```text
ORM planning (sql-orm-client/query-plan-select.ts)
  already resolves codecRefForStorageColumn and carries item.codec;
  wraps every JSON entry in NativeJsonValueProjection        → emit CodecJsonValueProjection
                                                               where a CodecRef is known,
                                                               JsonDocumentProjection where the
                                                               value is already a JSON document

PG renderer (adapter-postgres/sql-renderer.ts:698)
  visitor renders codec/native/document identically           → codec: resolve descriptor from the
                                                               validated registry, render
                                                               projectJson(value, ref) — scalar or
                                                               array lift per ref.many
                                                               document: identity (PG keeps subtype)

SQLite renderer (adapter-sqlite/adapter.ts:598)
  same identical visitor                                      → codec: projectJson via registry
                                                               document: jsonDocumentRetag — D6's
                                                               named seam, outermost level only
```

Because both renderers render the variants identically **today**, the ORM emission change is behavior-preserving on its own — a clean first dispatch with byte-parity evidence. The renderer flips are the observable cut, and each carries its own target's expectation updates.

### Sequencing constraint the seams impose

Emission before renderers: a renderer that differentiates variants while the ORM still emits `native` everywhere would change nothing; the reverse order (renderers first) is equally inert. The cut happens per target when its renderer lands on top of typed emission.

### Metadata removal

`metaFor`/`CodecMeta` survive at 33 sites in 9 production files (measured 2026-07-29; down from 103/43 pre-slice-2): the framework codec surfaces (`framework-components` × 4), `contract-psl/psl-column-resolution.ts`, `relational-core/ast/codec-types.ts`, and the transitional `meta` blocks on both targets' descriptors. Slice 2 retained these deliberately "until every consumer can switch atomically" — this is that switch. PostgreSQL native-type rendering already resolves through `PostgresCodecDescriptor` (slice 2's registry work); the removal dispatch enumerates any residual consumer by grep before deleting, per the D2-seam lesson: enumerate a method's consumers, not its callers-in-the-diff.

### Evidence this slice owes that slice 3's green cannot supply

Slice 3's spec records three structural limits of its harness: flat-object-over-base-table only, boundary-blind to values it was not given, and blind to database-written values. This slice's cut runs through the *production* render path, so its evidence must too:

1. **The include path, per affected codec.** `include-codecs.test.ts` covers `pg/bytea@1` alone of the seven strict-`decodeJson` codecs. The flip dispatches extend that coverage to the class — numeric, int8, interval, vector, and the SQLite siblings — so the producer/consumer pairing is proven where it actually runs, nested through derived tables.
2. **The project-DoD numeric regression on a selected query path**: `1234567890.12345678901234567890` and `9007199254740993` survive an ORM include exactly — the project's founding defect, finally closed where users hit it.
3. **The two prose-only limits become user-facing statements**: `pg/geometry@1` exempt (TML-3105) and floats canonical only at `extra_float_digits >= 1`. Nothing executable enforces either; the guarantee wording in docs and upgrade instructions is a **reviewable artifact**, not a footnote (slice 3 spec, `d8563a1a1e`).

## Coherence rationale

One outcome: the database starts producing what the codecs promise. Emission, two renderer flips, metadata removal, and the moved expectations are one reviewable claim — "canonical JSON is now what queries return" — and splitting them would strand a merge state where producers and strict consumers disagree, which is exactly the incoherence keeping #29830 draft. The pair (#29830 + this) merges together or in immediate sequence by operator decision (2026-07-29).

## Scope

**In:** ORM projection-variant emission; both renderers' visitor flips including SQLite retagging; `CodecMeta`/`meta`/`metaFor` removal (9 files); regenerated contracts/fixtures and moved e2e/integration expectations; include-path conformance for the seven-codec class; upgrade instructions for the flipped JSON forms and the stated-limits guarantee wording; finite-only generic SQL floats if grounding confirms the gap.

**Out:** aggregate descriptors, `aggregateTypes`, and ORM aggregate decoding (slice 5 — note `count()` already types `bigint` while runtime returns a string; that divergence is TML-3064's, not ours). Public testkit packages (slice 5). PostGIS (TML-3105). The `| Date` authoring-union residue and `Temporal` plain date-time (TML-3110). Optimized array projections beyond the reference lift.

## Pre-investigated edge cases

| Edge case | Disposition | Notes |
| --- | --- | --- |
| SQLite retag throws on non-JSON text | Apply at document boundaries only | D6's sharp edge, recorded in slice 3's spec: safe on `NULL`/integers, throws on `'hi'`. The visitor's `document` case receives only document-valued expressions by construction — assert that reasoning in the dispatch, don't inherit it. |
| **A NULL-eating construct followed by a default** | Known defect class — sweep anything that *assembles* rather than casts | Generalised at D2 review from two instances. `concat` drops NULLs and alone yields the visibly-wrong `'P'`; it was `coalesce(…, 'PT0S')` that made an absent interval read as a zero one (fixed in D2). SQLite's instance is live the moment D3 flips: `hex(NULL)` returns `''`, and `UPPERCASE_HEX` matches the empty string, so a NULL blob decodes to an empty `Uint8Array` with nothing raising. **D3 fixes it, not merely tests it.** Strict constructs (`CAST`, `encode`, `to_char`, `array_to_json`) propagate NULL and are exempt. |
| Retag placement | Outermost consumed level only | D6 proved retag-at-last suffices and the wrapper collapses; do not sprinkle per level. |
| `numeric(p,s)` scale-padding | Tripwire, not a task | If DDL emission ever produces parameterized numeric, PostgreSQL scale-pads and `col::text` disagrees with `encodeJson` by trailing zeros — structurally invisible to the slice-3 harness. Watch for it in include-path numeric evidence. |
| `extra_float_digits` | Session precondition | Include-path float evidence runs at the default; the bound is stated, not tested at `<= 0`. |
| Interval application value | `{months, days, micros}` object since PR review | JSON stays the ISO string; include-path interval evidence asserts the object surfaces from `decodeJson`. |

## Slice-specific done conditions

- [ ] `include-codecs.test.ts` passes, and include-path coverage exists for each of the seven previously-incoherent codecs; the two project-DoD numeric values round-trip exactly through a selected query path.
- [ ] `grep -rn 'metaFor\|CodecMeta' packages/ --include='*.ts'` returns no production site; the `projectJson` grep **inverts** — production render paths now must reach it.
- [ ] PR #29830's Integration Tests check is green on the stacked result, and the PR-pair merge sequence is stated in both PR descriptions.
- [ ] The canonical-JSON guarantee wording (docs + upgrade instructions) states both limits and was reviewed as an artifact, not a footnote.

## Open Questions

1. **Does computed-expression projection (no known `CodecRef`) stay `native`?** Working position: yes — `NativeJsonValueProjection` remains the correct variant for values with no codec identity; the project non-goal forbids an identity-default *for codecs*, not native semantics for codec-less values.
2. **Do `sql/float@1`-family codecs need finite-only enforcement here?** Working position: mirror `sqlite/real@1`'s D5 treatment if grounding shows the gap; a one-dispatch item, dropped if already covered.
3. **How much of the e2e/integration expectation movement is mechanical?** Working position: every changed assertion classifies as mechanical-form-change or corrected-old-defect, per the D2 discipline; anything unclassifiable halts.

## References

- Parent project: [`../../spec.md`](../../spec.md) · plan: [`../../plan.md`](../../plan.md)
- Predecessor slice (stacked under): [`../03-target-json-projection-implementations/spec.md`](../03-target-json-projection-implementations/spec.md) — PR [#29830](https://github.com/prisma/prisma/pull/29830), draft, merge-coupled
- Linear: [TML-3063](https://linear.app/prisma-company/issue/TML-3063/lossless-json-projection-hard-cut)
- The include-path seam correction: slice 3 spec § "The intermediate state this accepts — corrected at PR review"
- D6 retag handoff: slice 3 spec § "What D6's probe established, for slice 4's benefit"
