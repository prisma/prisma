---
changes:
  - id: typescript-contract-include-row-types
    summary: |
      A contract built with `defineContract` from TypeScript now types each relation with its target model, namespace and cardinality, as an emitted `contract.d.ts` does. Rows from `include(...)`, which were typed `unknown` and always as an array, now have the target model's field types: a has-many or many-to-many relation is an array, a belongs-to relation is one row (or `null` when optional), and a has-one relation is one row or `null`. A cast on an included value that disagrees with this type now fails to typecheck. The detection matches ORM `include` calls.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\.include\(\s*[''"`]'
---

# Included rows of a TypeScript contract have precise types

This applies to a contract built with `defineContract` from TypeScript, used without an emitted `contract.d.ts`.

The ORM typed every included relation as an array of `unknown` rows. It now reads each relation's target model and cardinality from the contract:

| Relation | Included value |
| --- | --- |
| `rel.hasMany`, `rel.manyToMany` | An array of the target model's rows |
| `rel.belongsTo` | One row, or the row or `null` when the relation is optional or any `from` field is optional |
| `rel.hasOne` | The row or `null` |

A cast that agrees with the new type still typechecks and can be removed. A cast that disagrees now fails to typecheck, and shows a real mismatch. A to-one relation was never an array at runtime, so fix the code that read it as one:

```diff
  const post = await db.orm.Post.include('author').first();
- const author = (post?.author as User[])[0];
+ const author = post?.author;
```

Include refinements now see the target model's fields, so `where`, `select` and `orderBy` inside them need no cast.

A relation to a model in another contract space keeps the general type, as before.
