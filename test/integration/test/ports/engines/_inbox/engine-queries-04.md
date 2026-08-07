## batching/transactional_batch.rs

- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/batching/transactional_batch.rs` › `queries::batching::transactional_batch::two_success` — atomic query-engine transactional batch of two creates returns one result per request — prisma-next has callback transactions but no public array/batch request API; replacing batch semantics with sequential callback operations would substitute the mechanism under test
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/batching/transactional_batch.rs` › `queries::batching::transactional_batch::two_query_for_batch` — query-engine transactional read batch returns one result per request after a write batch — prisma-next has callback transactions but no public array/batch request API or batch-result envelope
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/batching/transactional_batch.rs` › `queries::batching::transactional_batch::one_success_one_fail` — query-engine transactional batch rolls back all requests after a unique violation — prisma-next has callback transactions but no public atomic array/batch request API; sequential callback operations would not exercise query-engine batch rollback
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/batching/transactional_batch.rs` › `queries::batching::transactional_batch::batch_request_idx` — a failed query-engine batch reports the zero-based failing request index — prisma-next has no public batch request/result error surface or batch request index
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/batching/transactional_batch.rs` › `queries::batching::transactional_batch::one_query` — a single nested mutation inside a transactional batch rolls back its partial nested write — prisma-next has no public query-engine array/batch request API; translating this to an interactive callback transaction substitutes the batch mechanism
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/batching/transactional_batch.rs` › `queries::batching::transactional_batch::valid_isolation_level` — Serializable is accepted as a query-engine transactional batch option — prisma-next exposes no public array/batch request API with a per-batch isolation-level option
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/batching/transactional_batch.rs` › `queries::batching::transactional_batch::invalid_isolation_level` — an invalid query-engine transactional batch isolation-level string is rejected — prisma-next exposes no public array/batch request API accepting arbitrary isolation-level strings
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/batching/transactional_batch.rs` › `queries::batching::transactional_batch::isolation_level_mongo` — Mongo rejects an isolation-level option on a query-engine transactional batch — prisma-next exposes no public Mongo array/batch transaction API with an isolation-level option
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/batching/transactional_batch.rs` › `queries::batching::transactional_batch::raw_mix` — one PostgreSQL transactional batch mixes ORM mutation, executeRaw, and queryRaw requests — prisma-next has neither the query-engine array/batch request surface nor Prisma-style raw SQL string request operations

## chunking.rs

- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/chunking.rs` › `queries::chunking::issue_23743` — query-engine relation loading chunks a 200-parent `IN` request to stay below connector variable limits — prisma-next's public ORM has no query-engine query-chunk-size configuration or equivalent relation-load chunking mechanism, so the same read would not exercise the subject
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/chunking.rs` › `queries::chunking::issue_23919` — query-engine chunks a 400-record nested connect to avoid connector expression-tree limits — prisma-next has no public query-engine chunking mechanism and manually splitting or issuing separate relation writes would substitute the subject
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/chunking.rs` › `queries::chunking::in_more_items` — an `IN` list longer than the configured query-engine chunk size is split and deduplicated — prisma-next exposes `in` filtering but no public configurable chunk size or chunked-query execution, so the source's 24-item list cannot exercise the same mechanism
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/chunking.rs` › `queries::chunking::asc_in_ordering` — ascending order is preserved while the query engine merges chunked `IN` subqueries — prisma-next has ordering and `in` filtering but no public chunked-query merge mechanism; a single SQL query would test a different subject
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/chunking.rs` › `queries::chunking::desc_in_ordering` — descending order is preserved while the query engine merges chunked `IN` subqueries — prisma-next has ordering and `in` filtering but no public chunked-query merge mechanism; a single SQL query would test a different subject
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/chunking.rs` › `queries::chunking::order_by_aggregation_should_fail` — a query exceeding the connector bind limit with relation-aggregate ordering yields QueryParameterLimitExceeded — prisma-next exposes neither the query-engine excess-id generator/chunking limit nor this query-engine error surface
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/chunking.rs` › `queries::chunking::order_by_relevance_should_fail` — a query exceeding the connector bind limit with full-text relevance ordering yields QueryParameterLimitExceeded — prisma-next exposes neither Prisma relevance ordering nor the query-engine chunking-limit error surface

## chunking_qc.rs

- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/chunking_qc.rs` › `queries::chunking_qc::create_lots_of_m2m_relations` — query-compiler nested M:N creation exceeds the connector bind limit and chunks generated junction rows — prisma-next has no public query-compiler bind-limit chunking mechanism, and splitting the relation write manually would substitute the subject

## data_types/bigint.rs

PASS `test/integration/test/ports/engines/queries/data_types/bigint/bigint.test.ts` › `read_one` — nullable BigInt unique read round-trips 10000000000
PASS `test/integration/test/ports/engines/queries/data_types/bigint/bigint.test.ts` › `read_many` — nullable BigInt list read round-trips positive, negative, and null values

## data_types/bool.rs

PASS `test/integration/test/ports/engines/queries/data_types/bool/bool.test.ts` › `read_one` — nullable Boolean unique read round-trips true
PASS `test/integration/test/ports/engines/queries/data_types/bool/bool.test.ts` › `read_many` — nullable Boolean list read round-trips true, false, and null

## data_types/bytes.rs

PASS `test/integration/test/ports/engines/queries/data_types/bytes/bytes.test.ts` › `common_types` — Bytes values round-trip through a parent-to-children relation
PASS `test/integration/test/ports/engines/queries/data_types/bytes/bytes.test.ts` › `read_one` — nullable Bytes unique read round-trips the source base64 payload
PASS `test/integration/test/ports/engines/queries/data_types/bytes/bytes.test.ts` › `read_many` — nullable Bytes list read round-trips two payloads and null

## data_types/datetime.rs

PASS `test/integration/test/ports/engines/queries/data_types/datetime/datetime.test.ts` › `read_one` — nullable DateTime unique read round-trips the exact timestamp
PASS `test/integration/test/ports/engines/queries/data_types/datetime/datetime.test.ts` › `read_many` — nullable DateTime list read round-trips two exact timestamps and null

## data_types/decimal.rs

PASS `test/integration/test/ports/engines/queries/data_types/decimal/decimal.test.ts` › `read_one` — nullable Decimal unique read round-trips 12.3456 in prisma-next's Numeric string representation
PASS `test/integration/test/ports/engines/queries/data_types/decimal/decimal.test.ts` › `read_many` — nullable Decimal list read round-trips positive, negative, and null values

## data_types/enum_type.rs

PASS `test/integration/test/ports/engines/queries/data_types/enum_type/enum_type.test.ts` › `read_one` — nullable enum unique read round-trips member A
PASS `test/integration/test/ports/engines/queries/data_types/enum_type/enum_type.test.ts` › `read_many` — nullable enum list read round-trips A, B, and null
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/data_types/enum_type.rs` › `queries::data_types::enum_type::read_one_invalid_sqlite` — reading an invalid enum value manually inserted into SQLite yields the query-engine enum conversion error — SQLite is outside this corpus and this test is connector-exclusive
FAIL `test/integration/test/ports/engines/queries/data_types/enum_type/enum_type.test.ts` › `read_one_invalid_mongo` — reading raw-seeded enum member D should reject — `mongo/string@1` decodes D as an unrestricted string, so the ORM returns it instead of rejecting
