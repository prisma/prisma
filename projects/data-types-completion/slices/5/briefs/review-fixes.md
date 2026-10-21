# TML-3389: fixes from the branch review

Read `common-rules.md` first. Findings: `slices/5/reviews/system-design-review.md` (D01 to D09) and `slices/5/reviews/code-review.md` (F01 to F05). One commit per item, tests first where behaviour changes. I edit the ADRs and the plan.

1. **D01 and D02: one list of text types, owned by the target.** The target (not the adapter) contributes `textDataTypes`. Generators that write text apply to the assembled `textDataTypes`, read when the default is checked, not a list fixed when the registry is built; `sqlBuiltinGeneratorDescriptors` takes only the target's UUID type (`pg/uuid` on Postgres, none on SQLite), which the UUID generators also apply to. So an extension's text type that is in `textDataTypes` can be a discriminator and take `uuid()`. Test that with a test pack's text type.
2. **F01: a generator must fit the column.** Each generator states the length of what it writes, as a function of its arguments (`uuid` 36, `ulid` 26, `cuid` version 2's length, `nanoid` its size, `ksuid` 27; check the real lengths in `@internal/ids`). A column whose data type has a `length` parameter shorter than that refuses the generator at the `@default`, naming the column's length and the generator's output length. `VarChar(5) @default(uuid())` and a named type over `VarChar(3)` with `cuid(2)` are refused; `VarChar(36) @default(uuid())` and `Char(36) @default(uuid())` emit.
3. **F02.** A `@@base` value its column refuses (too long for `VarChar(5)`) is reported at the value, not the whole attribute; update the test.
4. **F03.** `nanoid(8.0)`, `uuid(4.0)`, `uuid(7.0)` and `cuid(2.0)` are now refused, because a number with a fraction is not an integer value; keep that, and add it to the app upgrade note with the fix (write `8`).
5. **F05.** A test documents `nanoid(3000000000)` on each target (Postgres: the `pg/int4` range message; SQLite: nanoid's own message).
6. **D06.** The lowering functions (`lowerUuid`, `lowerCuid` and the rest) move into the SQL family beside the signatures; each adapter keeps only what differs (Postgres's `printArguments`).
7. **D07.** If the interpreter has no text data types at all, that is an `InternalError`, not a refusal of every discriminator.
8. **D09.** Rename `argument-limits.ts` to `generator-limits.ts`.

Not now: D08 (Mongo checks the type name `String`; Mongo has no `textDataTypes`), and the code review's deferred items (the Prisma 7 reader does not check a generator against the column; optional `String?` discriminators). I record them in `deferred.md`.

## Checks

The touched packages' tests, `test/integration/test/authoring/` files for this slice, the upgrade detection test, `check:upgrade-coverage --mode pr --prev a65442a06b`, root `typecheck:agent`, `lint:deps`, `lint:framework-vocabulary`, `fixtures:check`. Push to `bot` (never force). Report one line per item with its commit, and anything the ADRs now get wrong.
