## Testing `relationMode` datasource property on all databases

Internal Notion pages

- [Project](https://www.notion.so/prismaio/Referential-Actions-TS-Test-Plan-52571af2aa6a48c1ae3a929880fd25aa)
- [Findings](https://www.notion.so/prismaio/Phase-1-Report-on-findings-f21c7bb079c5414296286973fdcd62c2)

Note: We are not testing SetNull with `foreignKeys` because it is invalid.
SetNull with a non-optionnal relation errors when the migration DDL is applied for all databases
(except for PostgreSQL where it fails at runtime)
Related issue to add a validation error: https://github.com/prisma/prisma/issues/14673

How to run these tests?

```sh
RELATION_MODE=foreignKeys pnpm run test:functional:code --relation-mode-tests-only
RELATION_MODE=prisma pnpm run test:functional:code --relation-mode-tests-only

# Or test default (no `relationMode` datasource property, which means using Foreign Keys for SQL databases)
pnpm run test:functional:code --relation-mode-tests-only

# To only run one test file, for example:
pnpm run test:functional:code --relation-mode-tests-only relationMode/tests_1-to-1.ts
pnpm run test:functional:code --relation-mode-tests-only relationMode/tests_1-to-n.ts
pnpm run test:functional:code --relation-mode-tests-only relationMode/tests_m-to-n.ts
pnpm run test:functional:code --relation-mode-tests-only relationMode/tests_m-to-n-MongoDB.ts
```

Some reproductions related to `relationMode`:

- [10000](../issues/10000/)
- [12378](../issues/12378/)
- [12557](../issues/12557/)
- [13766](../issues/13766/)
- [14271](../issues/14271/)
