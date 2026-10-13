---
changes:
  - id: model-with-no-fields-has-no-row-keys
    summary: |
      The emitted `contract.d.ts` types the fields and output types of a model with no fields as `{}` instead of `Record<string, never>`, so a row of that model has no keys. Reading any property of such a row, such as `row.legacy_key`, no longer compiles. Create and update inputs of that model still reject every key.
---

# A row of a model with no fields has no keys

Re-emit the contract. If code reads a property of a row of a model with no fields, the read now fails to compile, because the model has no field of that name. The value was never a field of the model: remove the read, or add a field to the model that maps the column.
