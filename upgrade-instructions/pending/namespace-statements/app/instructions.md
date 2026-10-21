---
changes:
  - id: removed-namespace-questions
    summary: |
      On Postgres, when the contract no longer declares a namespace the database's contract declared, `migration plan` and `db update` plan to drop its tables, asking about each model, and then the schema. Before, those tables were left in place without a word. Answer with `--delete <namespace>` to let them go, or keep a model by moving it with `--rename <namespace>.<Model>:<other namespace>.<Model>`.
---

# A removed namespace is asked about

If your contract removes a `namespace` block on Postgres, the next `migration plan` or `db update` asks about each model that namespace held, as it asks about any model you remove. A script that runs without a terminal fails with `CLI.CONSENT_REQUIRED`, listing each model. To drop them all and the schema, add `--delete <namespace>`:

```bash
prisma db update --delete billing
```

To keep a model's data, move it to a namespace the contract keeps in the same run, for example `--rename billing.Invoice:Invoice`, or put the namespace back in the contract.

A namespace that only another contract space declares, and a schema no contract ever declared, such as Supabase's `auth`, are still left alone.
