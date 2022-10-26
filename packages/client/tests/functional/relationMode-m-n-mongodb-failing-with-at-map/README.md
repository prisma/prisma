## Testing `relationMode` datasource property

See issue: Prisma Client: on MongoDB many-to-many relations: Unexpected results when using @map on the scalar list of referenced IDs
https://github.com/prisma/prisma/issues/15776

The tests are extracted from `relationMode`

- It only runs MongoDB
- On the m:n relation
- with `@map` / `@@map`
- all test (except 2) are turned into `test.failing()`
  - as we want to run these failing tests in CI but the CI status should pass

Once the issue is fixed

- Edit relationMode/tests_m-to-n-MongoDB.ts
  - Remove usage of `isSchemaUsingMap` and comment
- this directory can be deleted

How to run these tests?

```sh
pnpm run test:functional:code --relation-mode-tests-only relationMode-m-n-mongodb-failing-with-at-map
```
