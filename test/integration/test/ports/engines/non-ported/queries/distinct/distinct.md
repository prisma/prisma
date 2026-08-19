# Non-ported — queries/distinct.rs

- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/distinct.rs` › `queries::distinct::with_skip_orderby_nondistinct` — orderBy on a field outside the distinct set drives the final row order independently of which columns are being deduplicated — prisma-next's `distinctOn(...)` lowers to Postgres `DISTINCT ON`, which requires its leading `ORDER BY` expressions to match the distinct columns; there is no way to express a final ordering decoupled from the distinct set
