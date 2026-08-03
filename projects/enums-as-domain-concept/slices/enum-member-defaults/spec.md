# Slice: enum-member-defaults

Parent project: `projects/enums-as-domain-concept/`. Contributes **R3** — the last
parity prerequisite before the cutover: an enum field declares its default by naming a
**member**, and it lowers to the member's **value** as an ordinary literal column
default.

## At a glance

```prisma
enum2 Priority {
  @@type("pg/text@1")
  Low    = "low"
  High   = "high"
  Urgent = "urgent"
}

model Post {
  priority Priority @default(Low)    // names a member — not the raw string "low"
}
```

```ts
field.namedType(Priority).default(Priority.members.Low)   // members only; "lwo" is a compile error
```

Both lower to the same storage shape and DDL:

```jsonc
"default": "low"        // the resolved literal — plannable from storage alone
```

```sql
priority text NOT NULL DEFAULT 'low'
```

**Respecced 2026-06-10 (directional-invariant correction, project spec §9):** there is
**no `enumMember` `ColumnDefault` variant**. The storage column carries the resolved
**literal** default via the *existing* `{ kind: 'literal', value }` variant — storage
stays plannable in isolation (domain may reference storage; storage may never
reference domain). Grounding note: the variant the older plan text attributed to
TML-2851 was never actually shipped (`ColumnDefault` on main has only `literal` |
`function`), so there is nothing to remove — the respec lands as pure addition.

## Chosen design

Member-to-literal resolution happens **at lowering, per authoring surface**; below
the authoring layer nothing changes (the existing literal-default machinery carries
everything: validator, planner, `buildColumnDefaultSql` rendering, verification).

**1. TS DSL** (`contract-ts/src/contract-dsl.ts`): the `namedTypeField` overload for
`EnumTypeHandle` (~line 374) returns a builder whose `.default()` is typed to the
handle's **member value union** (`Values[number]` — the literal tuple the handle
already carries), not `ColumnDefaultLiteralInputValue`. A non-member literal is a
compile error (negative type-test). Lowering emits the ordinary
`{ kind: 'literal', value }`. `defaultSql` stays available unchanged.

**2. PSL** (`contract-psl/src/psl-field-resolution.ts`, default-attribute lowering
~343): when the field's type resolves to an enum2 (`enumTypeDescriptors` /
`enum2Handles` by-name lookup), a bare-identifier `@default(Low)` argument is checked
against the enum's member **names**: a match lowers to the member's **value** as a
literal default; a non-member is a lowering diagnostic naming the enum and the
attempted identifier. Non-enum fields' `@default` lowering is byte-identical
untouched; native-enum fields keep their existing behavior untouched.

**3. DDL/planner:** no changes — the literal default flows through the existing
`buildColumnDefaultSql` path. (If the demo migration surfaces a gap rendering a text
literal default in an alter/set-default op, that is a halt-and-report, not silent
scope growth.)

**4. Demo:** `@default(Low)` on the demo's `priority Priority` field
(`examples/prisma-8-demo/src/prisma/contract.prisma`); re-emit; a migration adding
the column default (set-default op per the migration-folder convention); the demo's
type tests assert the TS surface's members-only constraint compiles/rejects through
the emitted workflow where applicable.

**Deferred (unattended decision #3, `wip/unattended-decisions.md`):** recording
member-level *intent* on the domain field ("this default is `Priority.Low`") is out —
the authored source names the member and re-emit re-resolves it, so intent is
recoverable from source; record it later if introspection/diffing wants it.

## Coherence rationale

One outcome in one review: *"naming a member is the way an enum field declares its
default, on both authoring surfaces, and it lands as an ordinary literal."* Two
authoring-surface changes + a demo proof, zero machinery below the lowering.

## Scope

**In:** the TS `.default()` member-union typing + lowering (type tests incl.
negative); the PSL `@default(member)` resolution + diagnostic (interpreter tests:
member resolves to value; non-member diagnostic; non-enum fields untouched; native
enum untouched); demo vertical (PSL default, re-emit, migration, proof).

**Out:** any new `ColumnDefault` variant (settled — none); domain-side intent
recording (deferred, above); member defaults for native PSL enums (cutover concern);
Mongo (TML-2884); the check constraint (TML-2851, merged); execution-plane defaults
(`executionDefaults` — untouched).

## Contract-impact

None structural — the emitted default is the existing `literal` shape (`"default":
"low"` on the storage column). Demo artifacts change deliberately (the new default +
migration); `fixtures:check` zero-diff otherwise.

## Pre-investigated edge cases

| Edge case | Disposition | Notes |
| --- | --- | --- |
| `@default("low")` (quoted raw value) on an enum2 field | Diagnostic — members only | The Linear decision: default-by-raw-value severs the domain link. The PSL argument must be a bare identifier naming a member. |
| Member value is non-string (int codec, `Low = 1`) | Literal default carries the typed value | `ColumnDefaultLiteralInputValue` is `JsonValue`-wide; assert one non-string case in tests. DDL rendering for non-text codecs stays guarded as elsewhere in the project. |
| `@default(uuid())` / function defaults on an enum2 field | Diagnostic | A function default on a member-restricted column is not meaningful in this slice; reject with the members-only diagnostic. |

## Slice-specific done conditions

- [ ] Negative type-test: a non-member literal in TS `.default()` fails to compile.
- [ ] Interpreter test: PSL `@default(Low)` on an enum2 field emits
  `"default": "low"` on the storage column, identical to the TS-path equivalent
  (extend the existing parity test).
- [ ] Demo migration applies and `DEFAULT 'low'` is observable (insert without
  `priority` reads back `'low'`).

## Open Questions

None — design settled by the 2026-06-10 respec; degrees of freedom are
implementation-mechanical.

## References

- Parent: `projects/enums-as-domain-concept/spec.md` §9 (reworked), R3; `plan.md`
  (respecced entry); the settlement record in
  `../transitional-psl-enum-keyword/d5-carrier-alignment-proposal.md`.
- Linear: [TML-2855](https://linear.app/prisma-company/issue/TML-2855) — **body
  predates the respec**; the 2026-06-10 issue comment + this spec supersede the
  `enumMember`-variant design in it.
- Surfaces (grounded): `contract-ts/src/contract-dsl.ts` (227 `.default`, 365–377
  `namedTypeField` overloads, 374 the `EnumTypeHandle` overload);
  `contract-psl/src/psl-field-resolution.ts` (343+ default-attribute lowering);
  `contract/src/types.ts` (128 `ColumnDefault` = `literal` | `function` only);
  `enum-type.ts` (the handle's `values`/`enumMembers`); Postgres
  `planner-ddl-builders.ts` / `operations/columns.ts` (`buildColumnDefaultSql`,
  read-only expectation).
