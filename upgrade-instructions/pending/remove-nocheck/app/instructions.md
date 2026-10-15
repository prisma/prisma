---
changes:
  - id: psl-nocheck-removed
    summary: |
      The PSL attribute `@noCheck` no longer exists, and writing it is an unknown-attribute error. A list that allows null elements is now written `T?[]`. Replace `T[] @noCheck(elementNotNull)` with `T?[]`, delete `@noCheck(membership)`, and replace a bare `@noCheck` with both. The detection matches PSL files that use the attribute.
    detection:
      glob: "**/*.prisma"
      matches:
        - '@noCheck\b'
  - id: ts-nocheck-method-removed
    summary: |
      The TypeScript field builder no longer has a `noCheck()` method. Replace `.many().noCheck('elementNotNull')` with `.many({ elementsNullable: true })`, delete `.noCheck('membership')`, and replace a bare `.noCheck()` with both. The detection matches TypeScript files that call the method.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\.noCheck\('
  - id: prisma7-lists-allow-null-elements
    summary: |
      A contract read from a Prisma 7 `schema.prisma` now types the elements of every list as `T | null`, because Prisma 7 creates no check against null elements. The database is unchanged and `db verify` still passes. Re-emit the contract, then fix code that relied on the elements being non-null.
    detection:
      glob: "**/prisma.config.{ts,mts,cts,js,mjs}"
      matches:
        - '\bprisma7Schema\('
  - id: stored-contracts-drop-nocheck
    summary: |
      A stored SQL contract that has a `noCheck` key on a column no longer loads. Run `scripts/remove-nocheck/remove-nocheck.ts` from the project root. It removes the key from every stored contract, migration snapshots included, and rewrites the hashes and references that change. Then re-emit the contract.
    detection:
      glob: "**/contract.json"
      matches:
        - '"noCheck"\s*:'
    script: scripts/remove-nocheck/remove-nocheck.ts
---

# Generated checks can no longer be waived

Prisma 8 adds a check to a list column of a managed table so that its elements cannot be null, and a check to an enum-typed column so that it holds only the enum's values. `@noCheck` in PSL and `.noCheck()` in TypeScript used to skip these checks while the field kept its non-null element type. The client type then said the elements could not be null while the database accepted null. Both are removed.

## `psl-nocheck-removed`

Write a list whose elements may be null as `T?[]`:

```prisma
// Before
tags String[] @noCheck(elementNotNull)

// After
tags String?[]
```

The database does not change: neither form has a check. The element type gains `| null`, so code that reads the list must handle null elements.

If you want the check instead, delete the attribute and keep `T[]`. The next `prisma migration plan` adds the check. Applying it fails if a stored list already holds a null element.

Delete `@noCheck(membership)`. The next migration adds the membership check to the enum column. Applying it fails if a stored value is not one of the enum's values, so fix those rows first.

A bare `@noCheck` waived every check the column had. Apply both rules above: a list column becomes `T?[]`, and an enum column loses the attribute.

## `ts-nocheck-method-removed`

The same rules apply to the TypeScript builder:

```ts
// Before
tags: field.text().many().noCheck('elementNotNull'),
role: field.column(roleColumn).noCheck('membership'),

// After
tags: field.text().many({ elementsNullable: true }),
role: field.column(roleColumn),
```

`.many({ elementsNullable: true })` leaves the database as it is and types each element as `T | null`. Deleting `.noCheck('membership')` makes the next migration add the membership check.

## `prisma7-lists-allow-null-elements`

A Prisma 7 database has no check on its list columns, so it accepts null elements. The Prisma 7 reader now says so: a `String[]` field reads as a list of `string | null`. Nothing changes in the database, and the database still passes `prisma db verify` with no migration. Re-emit the contract with `prisma contract emit`, then fix the type errors where code assumed non-null elements.

## `stored-contracts-drop-nocheck`

Migration snapshots and any other stored `contract.json` written by an earlier release may have a `noCheck` key on a column. This release refuses such a contract and says to re-emit it. A historical snapshot cannot be re-emitted from today's source, so run the script instead. Do this before you re-emit any contract, and commit your work first so the script's changes can be reviewed and undone with git. Run it from the project root:

```sh
node <guide>/scripts/remove-nocheck/remove-nocheck.ts
```

`<guide>` is the directory that holds this guide. Node 24 or later runs the TypeScript script directly; it needs no `tsx`. The script reads and writes files only and needs no database. It removes the `noCheck` key from every column of every SQL contract under the root, skipping `node_modules`, `.git`, `dist` and `build`. That includes a test fixture of an old contract: if you keep one on purpose, restore it with git afterwards. The script does not change which checks a contract declares.

The storage hash covers the key, so the script also renames each changed snapshot directory to its new hash. It rewrites every `migration.json`, ref, `migration.ts` and `contract.d.ts` that names an old hash, and gives each changed migration a new `migrationHash`. It keeps the layout of each file it edits.

When it finishes, it prints how many files it rewrote, how many snapshot directories it renamed, and each storage hash it replaced (`<old> -> <new>`). A project with no `noCheck` key is left unchanged, and the script says so. It changes no file and exits 1 when a `contract.json`, `migration.json` or ref is not valid JSON, or when a renamed snapshot directory already exists with different content. If it stops partway, for example on a full disk, it says so; run it again to finish.

The database does not change, but its signature names the old storage hash. Sign each database with the new hash the script printed for the contract it was last migrated to (`prisma db sign <new hash>`). Then re-emit the contract and plan the next migration as usual.
