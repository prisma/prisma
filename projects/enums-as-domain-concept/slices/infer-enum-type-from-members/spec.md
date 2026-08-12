# Slice — Infer an enum's `@@type` from its members

**Linear:** [TML-2915](https://linear.app/prisma-company/issue/TML-2915)
**Project:** enums-as-domain-concept (`../../spec.md`)
**Branch:** `tml-2915-enum-conveniences`

## Outcome

An `enum` block may omit `@@type`; the codec is inferred from the members — the target's
**text** codec when every member is a bare name or a string value, the target's **int** codec
when every member is an integer value. Anything else (float, bigint, boolean, or a mix) is a
clear "add an explicit `@@type(...)`" diagnostic. An explicit `@@type` still wins and behaves
exactly as today. Applies to Postgres, SQLite, and Mongo.

```prisma
enum Role {            enum Priority {
  admin       →  pg/text@1     low  = 1     →  pg/int@1
  user                         high = 2
}                      }
```

## Why this is small

The parser already tags each enum member as `bare` (`admin`) or a value (`admin = 1`), and the
interpreter already lowers both — a `bare` member feeds its **name** through the codec, a value
member JSON-parses and decodes its RHS. Bare names and numeric member values already parse and
lower today. The **only** thing forcing verbosity is that `@@type` is mandatory
(`PSL_ENUM_MISSING_TYPE`, raised in `sqlFamilyEnumEntityDescriptor.output.factory` and its Mongo
sibling). This slice replaces that hard error, when `@@type` is absent, with inference. No parser
change, no new syntax.

## Builds on

The whole enum machinery already merged: the domain-enum authoring path, the `enum` PSL block +
member grammar (bare vs value), the per-family `authoring-entity-types.ts` factories, and
codec-typed emission (TML-2952). This slice adds only the inference step in front of the existing
factory body.

## Requirements

- **R1 — Inference rule.** When an `enum` block has no `@@type`, choose the codec by scanning the
  members' *raw* shapes (before decoding, since decoding needs the codec):
  - every member is `bare`, or a value whose JSON is a **string** → target **text** codec;
  - every member is a value whose JSON is an **integer** → target **int** codec;
  - otherwise → diagnostic `PSL_ENUM_CANNOT_INFER_TYPE` ("cannot infer `@@type` for enum
    \"<name>\"; add an explicit `@@type(...)`"). No float/bigint/boolean/mixed inference.
- **R2 — Explicit wins.** With `@@type` present, behavior is byte-identical to today (same codec
  resolution, same member decoding, same diagnostics). Inference is reached only on omission.
- **R3 — Post-inference path is the existing path.** After a codec is chosen, the existing member
  loop runs unchanged (bare → `codec.decodeJson(name)`; value → decode parsed JSON), so a bare
  member under an inferred int codec still errs exactly as it does under an explicit one.
- **R4 — Target-declared defaults.** The family-level factory is target-agnostic; each target
  pack supplies its default text + int enum codec ids (Postgres `pg/text@1`/`pg/int@1`, SQLite
  `sqlite/text@1`/`sqlite/integer@1`, Mongo `mongo/string@1`/`mongo/int32@1`) through the
  authoring context. No guessing a default from `targetTypesFor` reverse-lookups.
- **R5 — Both families.** SQL (`packages/2-sql/9-family`) and Mongo
  (`packages/2-mongo-family/9-family`) infer identically; the classification logic is shared, not
  duplicated per family.

## Out of scope

- New syntax — this is `@@type` *omission*, not a keyword form.
- TS `enumType`/`member` parity — that API keeps its explicit codec.
- Float / bigint / boolean / mixed-type inference — explicit `@@type` required.
- Any change to member-value grammar, decoding, or the emitted contract shape when `@@type` is
  present.

## Definition of done

- PSL `enum` with no `@@type` + bare/string members emits the target's text codec; + integer
  members emits the target's int codec — proven by emit-then-consume tests on Postgres, SQLite,
  and Mongo (author → emit → the field types as the value union; the value set / validator carries
  the inferred codec).
- A mixed/float/bigint/boolean no-`@@type` enum yields the `PSL_ENUM_CANNOT_INFER_TYPE`
  diagnostic (negative test per family).
- Explicit-`@@type` fixtures are unchanged (`fixtures:check` clean).
- Build, typecheck, full test suites, `lint:deps`, `lint:casts` (no new casts) all green.

## Design notes

- **Inference sits in front of the factory body.** In each family's enum entity factory, when the
  `@@type` attr is absent, run the classifier over `block.parameters` to pick a codec id from the
  context-supplied defaults, then continue into the existing codec-resolution + member loop with
  that id. Present `@@type` skips the classifier entirely (R2).
- **Carrying the defaults.** Extend `AuthoringEntityContext`
  (`@internal/framework-components/authoring`) with the target's default enum codec ids (e.g.
  `enumInferenceCodecs: { text: string; int: string }`), populated where each pack builds the
  authoring context. This is the single new framework surface.
- **Classifier is shared.** One helper classifies the member set → `'text' | 'int' | null`
  (null = not inferrable) from the raw param shapes; both family factories call it. Note the
  parser's param kinds are richer than bare/value (`Bare`/`List`/`Option`/`Ref`) — the classifier
  treats anything that isn't a bare name or a string/integer scalar value as not-inferrable.
