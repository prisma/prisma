---
changes:
  - id: mongo-rename-statements-carried-out
    summary: |
      On MongoDB, `migration plan` and `db update` carry out `--rename`: a model rename renames its collection, keeping the documents, indexes and validator, and a field rename renames the field in every document that holds it. They used to refuse every statement with `MIGRATION.PLANNING_FAILED`. A question about a dropped collection now offers `--rename` as well as `--delete`.
  - id: mongo-removed-field-asks
    summary: |
      On MongoDB, removing a field from a model is now data loss. `migration plan` and `db update` ask about it, and fail with `CLI.CONSENT_REQUIRED` where nobody can answer, until `--delete <Model>.<field>` or a `--rename` answers it. `--delete` removes the field from every document that holds it.
  - id: mongo-preview-get-collection
    summary: |
      A MongoDB plan's preview writes each collection as `db.getCollection("users")`, for example `db.getCollection("users").createIndex(...)` where it wrote `db.users.createIndex(...)`. `ops.json` does not change.
    detection:
      glob: "**/*.{ts,mts,cts,js,mjs,cjs,snap}"
      matches:
        - 'db\.[A-Za-z_][\w]*\.(?:createIndex|dropIndex|drop)\('
  - id: mongo-time-series-update
    summary: |
      `db update` on a database with a MongoDB time-series collection no longer fails with "Cannot change immutable collection option 'timeseries'" when nothing changed.
  - id: storage-question-wording
    summary: |
      A data-loss question about data named by its storage name, because the origin contract is unknown, ends with `--delete loses that data` instead of `--delete loses its rows`.
    detection:
      glob: "**/*.{ts,mts,cts,js,mjs,cjs}"
      matches:
        - '--delete loses its rows'
---

# MongoDB carries out `--rename` and `--delete`

## `mongo-rename-statements-carried-out`

`--rename` now works on MongoDB, with the same syntax as on SQL. A field is named by its contract key, which on MongoDB is its stored name: `id @map("_id")` is `User._id`.

```sh
prisma migration plan --name tidy --rename Profile:User --rename User.name:User.fullName
prisma db update --rename Profile:User --rename User.name:User.fullName
```

- A model rename whose collection name changes renames the collection (`renameCollection`), keeping its documents, indexes and validator.
- A field rename renames the field in every document that holds it (`renameField`), skipping validation. A variant's field is renamed only in that variant's documents.
- The planner refuses, with the reason and what to do instead: a variant rename whose discriminator value changes, `_id`, a field whose stored name contains `.` or starts with `$`, a time-series collection, a target collection that already exists or that MongoDB rejects, and a collection whose control policy is not `managed`. A field removed from a model whose collection is not `managed` is not asked about and not removed.

If you renamed a collection or a field by hand in `mongosh` because `--rename` was refused, nothing changes for migrations you already applied. From now on, give the `--rename` statement instead.

A script or test that expects `--rename` on MongoDB to fail with `MIGRATION.PLANNING_FAILED` now gets a plan. A script that reads `meta.unanswered` of `CLI.CONSENT_REQUIRED` for a dropped MongoDB collection now finds `verbs: ['rename', 'delete']` instead of `['delete']`.

## `mongo-removed-field-asks`

Removing a field from a MongoDB model used to update the collection's validator and ask nothing. Documents that still held the field then failed every update with `Document failed validation`. Now the plan removes the field from those documents (`unsetField`, a `destructive` operation) and asks first. Where nobody can answer, the command fails with `CLI.CONSENT_REQUIRED`, whose next actions name `--delete User.nickname` and `--rename 'User.nickname:User.<new name>'`.

In a script or CI job that runs `prisma db update --no-interactive` or `prisma migration plan` after a field was removed, add `--delete <Model>.<field>` for each removed field, or `--rename` if the field was renamed. When `db update` has no snapshot of the contract the database is at, the field is named by its collection: `--delete profiles.nickname`.

## `mongo-preview-get-collection`

A test or a script that compares the preview of a MongoDB plan (`migration plan`, `db update --dry-run`, `migration show`) expects `db.getCollection("<name>")` in place of `db.<name>`, so a collection name such as `my-coll` is valid `mongosh`. Plans and `ops.json` are unchanged.

## `mongo-time-series-update`

A repeated `db update` on a database whose contract declares a time-series collection used to fail with "Cannot change immutable collection option 'timeseries'", because MongoDB adds defaults such as `bucketMaxSpanSeconds` that the contract leaves out. The planner now compares only the options the contract declares, so the command succeeds and plans nothing. A workaround that skipped `db update` for such a database is no longer needed.

## `storage-question-wording`

A test that asserts the text of a data-loss question about data named by its storage name expects `--delete loses that data` where it expected `--delete loses its rows`.
