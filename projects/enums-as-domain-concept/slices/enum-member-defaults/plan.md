# Dispatch plan — enum-member-defaults (TML-2855)

Slice spec: [`./spec.md`](./spec.md). Two sequential dispatches: the two authoring
surfaces land together (one semantic change seen from two sides, proven equal by the
parity test), then the demo vertical carries the slice-wide sweep. Branch
`tml-2855-slice-enum-member-defaults-defaultadmin-renders-default`, stacked on the
TML-2882 branch (unattended decision #2). Implementer tier: sonnet-mid; reviewer:
opus.

### Dispatch 1: member-resolved defaults on both authoring surfaces

- **Outcome:** `field.namedType(Priority).default(Priority.members.Low)` compiles
  only with the member value union (negative type-test red on a non-member) and
  lowers to `{ kind: 'literal', value }`; PSL `@default(Low)` on an enum2 field
  resolves the member name to its value and lowers to the same literal default,
  with diagnostics for non-member identifiers, quoted raw values, and function
  defaults on enum2 fields; the PSL/TS parity test extended with a defaulted field
  stays strictly equal incl. `storageHash`. Non-enum and native-enum `@default`
  lowering byte-identical untouched.
- **Builds on:** the merged literal-default machinery (no new variant — settled);
  TML-2882's enum2 descriptors/handles in the interpreter; the `EnumTypeHandle`
  literal value tuple.
- **Hands to:** member defaults authorable on both surfaces — everything D2's demo
  needs.
- **Focus:** `contract-ts/src/contract-dsl.ts` (the `EnumTypeHandle` `namedTypeField`
  overload's builder `.default()` typing + lowering); `contract-psl/src/psl-field-resolution.ts`
  (default-attribute lowering branch for enum2-resolved fields — member-name lookup
  via the existing by-name handle map); tests in both packages + the parity-test
  extension; one non-string-codec member-default case. **Out:** demo (D2), DDL/planner
  changes (none expected — halt if the literal path can't carry it).

### Dispatch 2: demo vertical + slice sweep

- **Outcome:** the demo's `priority Priority` field carries `@default(Low)`;
  artifacts re-emitted; a migration adds the column default per the folder
  convention; an insert omitting `priority` reads back `'low'` (exercised via the
  demo's test/command pattern); slice-wide sweep green (`test:packages`, full
  `typecheck`, `fixtures:check` zero-diff outside the demo's deliberate changes,
  `lint:deps`, cast ratchet).
- **Builds on:** D1.
- **Hands to:** the slice-DoD; with TML-2885, the cutover's parity prerequisites.
- **Focus:** `examples/prisma-8-demo` (contract.prisma, emit, migration,
  proof). Stage only named files; verify `git diff --staged --stat` (standing
  guardrail). **Out:** anything beyond the demo + sweep.
