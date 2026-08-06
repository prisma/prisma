# Non-ported — raw-queries-mysql-column-type

- `packages/client/tests/functional/raw-queries/mysql-column-type/test.ts` › `columns with _bin collation return strings, not Uint8Array` — alters MySQL columns to `utf8mb4_bin`, reads them through `$queryRaw`, and verifies MySQL raw-result type decoding returns strings — non-portable because the test is MySQL-specific while MySQL is an unsupported target for this project, and its `_bin` collation/type-decoding behavior cannot be faithfully exercised on Postgres or MongoDB.
