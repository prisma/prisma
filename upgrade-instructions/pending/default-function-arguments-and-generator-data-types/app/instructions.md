---
changes:
  - id: prisma7-default-function-arguments-checked
    summary: |
      The reader for a Prisma 7 schema checks a default function's arguments as Prisma 8 does. An argument the function does not take, such as `uuid(5)`, `cuid(1)`, `nanoid(1)` or `nanoid(1000)`, is refused with `PSL.PRISMA7_UNKNOWN_DEFAULT` and the function's message, where it used to be read as something else (`uuid(5)` as a version 4 UUID, `cuid(1)` as `cuid(2)`). A named argument, such as `nanoid(size: 8)`, is refused too. Write the argument positionally and inside the function's range.
    detection:
      glob: "**/*.prisma"
      matches:
        - '\buuid\(\s*(?![47]\s*\))[^\s)]'
        - '\bcuid\(\s*(?!2\s*\))[^\s)]'
        - '\bnanoid\(\s*(?:[01]\s*\)|\d{4,}|[3-9]\d\d|2[6-9]\d|25[6-9]|[^)]*[.:])'
  - id: default-function-argument-diagnostics
    summary: |
      In Prisma 8 PSL, an argument of `uuid`, `cuid` or `nanoid` the function does not take is reported with the code `PSL_INVALID_DEFAULT_FUNCTION_ARGUMENT` instead of `PSL_INVALID_ATTRIBUTE_SYNTAX`, and with the function's message, such as `uuid: version must be 4 or 7, got 5`. A missing or extra argument names the callee `Default function "<name>"` instead of `Attribute "<name>"`.
    detection:
      glob: "**/*.{ts,mts,cts,tsx,js,mjs,cjs,json}"
      matches:
        - 'Expected one of: 4 \| 7'
        - 'Expected an integer between 2 and 255'
        - 'Attribute \\?"(?:uuid|cuid|nanoid|ulid|now|autoincrement)\\?"'
  - id: generator-applicability-names-data-type
    summary: |
      `PSL_INVALID_DEFAULT_APPLICABILITY`, reported for a generated default on a column it does not apply to, names the column's data type instead of its codec: `Default generator "uuidv4" is not applicable to "Row.value" with data type "pg/int4".` where it said `with codecId "pg/int4@1"`.
    detection:
      glob: "**/*.{ts,mts,cts,tsx,js,mjs,cjs,json}"
      matches:
        - '\bwith codecId \\?"'
  - id: generator-fits-column
    summary: |
      A generated default is refused when the column is too short for what the generator writes: `Char(5) @default(nanoid())` (a Nano ID is 21 characters) and `VarChar(5) @default(uuid())` report `PSL_INVALID_DEFAULT_APPLICABILITY`, `Default generator "nanoid" writes 21 characters, but "Row.value" holds at most 5.` Such a column failed at the first insert before. Widen the column, or for `nanoid` pass a size that fits.
  - id: discriminator-must-be-text
    summary: |
      A SQL `@@discriminator` field that is not text is refused with the message `must be text, such as String, but is "<type>"` instead of `must be of type String, but is "<type>"`. A discriminator may now also be a `Char(n)` or `VarChar(n)` column, and a `@@base` value is checked against the column's type, so a value longer than a `VarChar(n)` column holds is refused. Mongo's message is unchanged.
    detection:
      glob: "**/*.{ts,mts,cts,tsx,js,mjs,cjs,json}"
      matches:
        - '(?<![\s\S])(?![\s\S]*[Mm]ongo)[\s\S]*must be of type String'
---

## `prisma7-default-function-arguments-checked`

A Prisma 7 schema the reader used to accept with a changed meaning is now refused:

```prisma
// Before: read as a version 4 UUID, a CUID2 identifier, and a 1-character Nano ID
id    String @id @default(uuid(5))
code  String @default(cuid(1))
short String @default(nanoid(1))
named String @default(nanoid(size: 8))

// After: write what the generator makes
id    String @id @default(uuid(4))
code  String @default(cuid(2))
short String @default(nanoid(2))
named String @default(nanoid(8))
```

Each refusal is `PSL.PRISMA7_UNKNOWN_DEFAULT`, reported at the argument, with the function's message: `Field "User.id": uuid: version must be 4 or 7, got 5`. `cuid()` with no argument still reads as `cuid(2)`. Pick the value that keeps what your application stores today: `uuid(5)` made version 4 UUIDs, `cuid(1)` made CUID2 identifiers.

## `default-function-argument-diagnostics`

Code or tests that match the diagnostics of a Prisma 8 schema read the new code and messages:

```ts
// Before
expect(diagnostic).toMatchObject({ code: 'PSL_INVALID_ATTRIBUTE_SYNTAX', message: 'Expected one of: 4 | 7' });

// After
expect(diagnostic).toMatchObject({
  code: 'PSL_INVALID_DEFAULT_FUNCTION_ARGUMENT',
  message: 'uuid: version must be 4 or 7, got 5',
});
```

The messages are `uuid: version must be 4 or 7, got <n>`, `cuid: version must be 2, got <n>` and `nanoid: size must be between 2 and 255, got <n>`. An argument that is not a whole number, such as `nanoid(8.5)` or `nanoid("8")`, is `PSL_VALUE_TYPE_INCOMPATIBLE`, as for any value of the integer type.

## `generator-applicability-names-data-type`

```ts
// Before
'Default generator "uuidv4" is not applicable to "Row.value" with codecId "pg/int4@1".'

// After
'Default generator "uuidv4" is not applicable to "Row.value" with data type "pg/int4".'
```

## `generator-fits-column`

```prisma
// Before: emitted, then every insert failed with "value too long"
code Char(5) @default(nanoid())

// After
code Char(21) @default(nanoid())
code Char(5)  @default(nanoid(5))
```

The lengths are: `uuid` 36, `ulid` 26, `cuid(2)` 24, `nanoid()` 21 and `nanoid(n)` n.

## `discriminator-must-be-text`

This applies to SQL schemas only; a Mongo schema's discriminator message is unchanged.

```ts
// Before
'Discriminator field "type" on model "Task" must be of type String, but is "Int"'

// After
'Discriminator field "type" on model "Task" must be text, such as String, but is "Int"'
```
