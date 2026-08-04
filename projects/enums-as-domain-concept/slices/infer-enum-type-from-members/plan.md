# Plan — Infer an enum's `@@type` from its members

**Spec:** `./spec.md` · **Linear:** [TML-2915](https://linear.app/prisma-company/issue/TML-2915)
**Branch:** `tml-2915-enum-conveniences` (off current `main`)

One slice, two sequential dispatches (D2 reuses the shared classifier + context field D1 lands).
Tests-first in each.

## Grounded boundaries

- **Change point (both families):** the `output.factory` in
  `packages/2-sql/9-family/src/core/authoring-entity-types.ts` (`sqlFamilyEnumEntityDescriptor`)
  and `packages/2-mongo-family/9-family/src/core/authoring-entity-types.ts`. Both find the
  `@@type` attr and, when absent, push `PSL_ENUM_MISSING_TYPE` and bail. Inference replaces that
  bail: classify members → pick a default codec id → fall through into the existing
  codec-resolution + member loop unchanged.
- **Member shapes:** `block.parameters` entries carry a `kind`. The interpreter already switches
  on `'bare'` vs value; the parser's exported param kinds are `PslExtensionBlockParamBare`,
  `…ParamList`, `…ParamOption`, `…ParamRef` (`@internal/psl-parser` exports). The classifier
  must read the raw value (for a value param, `JSON.parse(raw)` then `typeof`/`Number.isInteger`)
  and treat list/option/ref as not-inferrable. Confirm the exact value-param kind name and raw
  accessor when implementing.
- **Context:** `AuthoringEntityContext` (`@internal/framework-components/authoring`) currently
  exposes `codecLookup`, `sourceId`, `diagnostics`. It gains the target's default enum codec ids.
  Find where each pack constructs/passes this context (the CLI/build authoring path + the
  control-stack path) and populate the new field there.
- **Default codec ids (already constants):** Postgres `PG_TEXT_CODEC_ID='pg/text@1'` /
  `PG_INT_CODEC_ID='pg/int@1'` (`packages/3-targets/3-targets/postgres/src/core/codec-ids.ts`);
  SQLite `SQLITE_TEXT_CODEC_ID` / `SQLITE_INTEGER_CODEC_ID`
  (`…/sqlite/src/core/codec-ids.ts`); Mongo `MONGO_STRING_CODEC_ID` / `MONGO_INT32_CODEC_ID`
  (`packages/3-mongo-target/2-mongo-adapter/src/core/codec-ids.ts`).
- **Tests:** emit-then-consume is the standard here (verify through emit, not `typeof contract`) —
  author PSL → emit → assert the field types as the value union and the inferred codec is present.
  Negative tests assert the `PSL_ENUM_CANNOT_INFER_TYPE` diagnostic.

## D1 — shared classifier + framework context + SQL side

1. **Framework:** add `enumInferenceCodecs: { text: string; int: string }` (name TBD by the
   implementer to fit the existing type) to `AuthoringEntityContext`.
2. **Shared classifier:** one helper (in framework-components/authoring, next to the context type)
   `classifyEnumMemberType(block): 'text' | 'int' | null` over the raw param shapes.
3. **SQL family factory:** when `@@type` is absent, call the classifier; `null` → new
   `PSL_ENUM_CANNOT_INFER_TYPE` diagnostic; otherwise pick `ctx.enumInferenceCodecs.text|int` and
   fall through to the existing body. Present `@@type` path untouched.
4. **Packs:** Postgres and SQLite populate `enumInferenceCodecs` from their codec-id constants
   wherever they build the authoring context.
5. **Tests-first:** per Postgres + SQLite — no-`@@type` text enum, no-`@@type` int enum (emit →
   value-union typed, inferred codec present), explicit-`@@type` unchanged, and the mixed/float
   negative → `PSL_ENUM_CANNOT_INFER_TYPE`.
6. **Verify:** build + typecheck + test for the touched SQL/target/framework packages;
   `fixtures:check` (explicit-`@@type` fixtures unchanged); `lint:deps`, `lint:casts`.

## D2 — Mongo side (reuses D1)

1. **Mongo family factory:** same inference in
   `packages/2-mongo-family/9-family/src/core/authoring-entity-types.ts`, calling the shared
   classifier + `ctx.enumInferenceCodecs`.
2. **Mongo pack:** populate `enumInferenceCodecs` from `MONGO_STRING_CODEC_ID` /
   `MONGO_INT32_CODEC_ID`.
3. **Tests-first:** Mongo no-`@@type` text + int (emit → value-union typed, `$jsonSchema`
   validator/value-set carries the inferred codec), explicit-`@@type` unchanged, mixed/float
   negative.
4. **Verify:** Mongo package build/typecheck/test; `fixtures:check`; full gate before PR.

## Open items to resolve during D1

- The exact value-param `kind` name + raw accessor (grounding note above) — verify against
  `@internal/psl-parser` before writing the classifier.
- Where exactly each pack builds `AuthoringEntityContext` (may be more than one call site —
  CLI/build vs control-stack). All construction sites must set `enumInferenceCodecs`.
- Whether `enumInferenceCodecs` should be required (all packs must set it) or optional (absent →
  inference disabled, `@@type` still required). Prefer **required** for predictability; make the
  type non-optional and update every construction site.

## Not doing

New syntax; TS parity; float/bigint/boolean/mixed inference; any change to the present-`@@type`
path or the emitted contract shape. (Spec § Out of scope.)
