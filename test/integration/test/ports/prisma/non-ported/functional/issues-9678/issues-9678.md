# Non-ported — issues-9678

- `packages/client/tests/functional/issues/9678/tests.ts` › `concurrent deleteMany/createMany` — concurrent deleteMany+createMany retries on write-conflict without corrupting data — `$transaction([...], { isolationLevel })` has no transaction-with-isolation-level API in prisma-next; also uses `jest.retryTimes` + `testIf` with no harness equivalent
