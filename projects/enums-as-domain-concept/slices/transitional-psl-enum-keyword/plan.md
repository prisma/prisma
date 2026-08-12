# Dispatch plan — transitional-psl-enum-keyword (TML-2882)

Slice spec: [`./spec.md`](./spec.md). Three sequential dispatches following the
vertical: grammar → interpreter + pack registration → demo proof. Each hands a stable
state to the next; D3 carries the slice-wide additivity sweep (the TML-2852 precedent).
Implementer tier: sonnet-mid; reviewer: opus.

### Dispatch 1: `enum2` grammar — parser + AST

- **Outcome:** the psl-parser parses `enum2 <Name> { @@type("<codec-id>") Name = <json> … }`
  into a distinct AST node kind (members carry name + optional raw value text + span;
  the block carries its attributes), and rejects malformed blocks with span-accurate
  diagnostics. Native `enum` parsing is byte-identical untouched. Parser unit tests
  cover: bare members, `= value` members (string, number, mixed), `@@type` presence,
  missing `@@type` parsed through (required-ness is interpreter validation, not
  grammar — confirm split at dispatch time), duplicate member names at the AST level
  only if the native enum parse does the same, and a native `enum` + `enum2` document
  side by side.
- **Builds on:** the merged substrate only. Spec § Chosen design 1.
- **Hands to:** the `enum2` AST shape (exported from the parser's syntax surface) that
  D2's interpreter path consumes.
- **Focus:** `psl-parser/src/parser.ts` — a dedicated block parse alongside `enum`
  (~line 148; not the generic extension-block path, which lacks `@@` attribute
  support); the AST type additions in the parser's syntax exports /
  `framework-components` psl-ast as the existing `PslEnum` precedent dictates; the
  member regex extension for `Name = <literal>` (raw capture, no JSON parsing in the
  parser). Check whether any in-scope flow round-trips schemas through `psl-printer`
  (spec edge case): if yes, add minimal `enum2` printing; if no, record that and leave
  it. **Out:** all lowering (D2), demo (D3).

### Dispatch 2: interpreter lowering path + Postgres `entityTypes.enum2` registration

- **Outcome:** a PSL document with an `enum2` block and a using field emits a contract
  whose domain `enum`, storage `valueSet`, field/column `valueSet` refs, and table
  check are **equal to the equivalent TS `enumType` authoring's output** (asserted by
  an interpreter test comparing the two). Validation diagnostics fire for: missing
  `@@type`; unknown codec id; non-JSON / codec-rejected member RHS (the
  `PSL_EXTENSION_INVALID_VALUE` pattern); bare member under a non-string codec;
  duplicate member names/values; `enum2` name colliding with a native `enum`;
  namespaced `enum2` (not supported); a target whose contributions lack
  `entityTypes.enum2`.
- **Builds on:** D1's AST shape.
- **Hands to:** PSL-authorable new-shape enums on the Postgres target — everything D3's
  demo needs.
- **Focus:** `contract-psl/src/interpreter.ts` — a `processEnum2Declarations` parallel
  to `processEnumDeclarations` (line 312): contribution lookup via
  `getAuthoringEntity(…, ['enum2'])`, codec resolution + member validation
  (`JSON.parse` + `codec.decodeJson`, reusing the extension-block validator pattern;
  thread the existing `CodecLookup` — don't build a second registry), `EnumTypeHandle`
  production, `ColumnDescriptor` entries into the shared `enumTypeDescriptors` map
  (field resolution unchanged), `enumTypeHandle` attachment onto the resolved
  `FieldNode`, and `enums` passed into the existing `buildSqlContractFromDefinition`
  call (line 2151) — zero new lowering code. Postgres pack: the `entityTypes.enum2`
  entry in `postgresAuthoringEntityTypes` (`postgres/src/core/authoring.ts:43–53`);
  the factory I/O shape is the executor's call (spec open question 1 — fewest casts,
  handle construction in one place). **Out:** demo and emitted-artifact changes (D3);
  member defaults (TML-2855).

### Dispatch 3: demo vertical — author, emit, migrate, consume + slice additivity sweep

- **Outcome:** the demo authors `enum2 Priority` in `src/prisma/contract.prisma`
  (same members as the TS-path `Priority` in `prisma/contract.ts`); re-emitted
  `contract.json` / `contract.d.ts` carry the enum and the field's value union; a
  migration under `migrations/app/` adds the `priority` column, the `Priority`
  value-set, and the check; a `main.ts` subcommand consumes the enum **through the
  emitted contract** — a type-test asserts the field reads as
  `'low' | 'high' | 'urgent'` off the emitted `contract.d.ts` (verify-through-emit,
  not `typeof` on an in-memory definition), and the command exercises
  `db.enums.public.Priority.values` and an `ORDER BY priority` returning declaration
  order against the demo database. **Slice additivity sweep:** native-enum output
  byte-identical (the demo's `user_type` and all native fixtures); `fixtures:check`
  zero-diff outside the demo's own deliberately re-emitted artifacts; full
  `pnpm typecheck` clean; cast ratchet not increased.
- **Builds on:** D2 (the lowering is live on the Postgres target). Non-linear: also
  reads D1's grammar directly (the schema file).
- **Hands to:** the slice-DoD — the new mechanism live through the product path.
  Closes the slice; hands to TML-2855 (PSL `@default(member)` now has a real PSL enum
  field) and TML-2853 (cutover = rename + migrate + delete).
- **Focus:** `examples/prisma-8-demo` — `src/prisma/contract.prisma`, `pnpm emit`,
  the migration-folder convention (`migrations/app/<stamp>_<name>/` — confirm the CLI
  flow produces it; hand-author only what the convention requires, spec open
  question 3), `src/main.ts` subcommand. Stage only named files; verify
  `git diff --staged --stat` before committing (TML-2852 D1 lesson). **Out:** member
  defaults; non-text codecs in the demo.

## Open items

- Final keyword spelling is settled as `enum2` in the spec; operator may override
  before D1 dispatches (rename is a find-replace at that point, trivial).
