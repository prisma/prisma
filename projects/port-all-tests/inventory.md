# Source-test inventory — port-all-tests

The scope contract for [`spec.md`](./spec.md). Every suite below carries an in/out-of-scope verdict; the in-scope rows are the porting work-list. Counts were measured on the pinned checkouts:

- `prisma/prisma` @ `a6d01554528e016bea1467a072776b0e2b94dcba` (`/tmp/prisma`)
- `prisma/prisma-engines` @ `e922089b7d7502aff4249d5da3420f6fa55fc6ad` (`/tmp/prisma-engines`)

Scope rules (from the spec): functional/integration tests that exercise public APIs only — generated-client ORM API, CLI commands, migrate workflows (prisma); query-engine JSON/GraphQL protocol, schema-engine JSON-RPC surface, schema-engine CLI (engines). Target databases: Postgres (PGlite) + MongoDB (memory-server). Provider-matrix tests port their postgres/mongo entries; tests exclusive to unsupported providers become individual `non-ported.md` lines.

## prisma/prisma → `test/integration/test/ports/prisma/`

### IN SCOPE — primary

| Suite | Path | Volume | Notes |
| --- | --- | --- | --- |
| Client functional tests | `packages/client/tests/functional/**` | 740 `.ts` files; 88 top-level suite dirs; 443 files outside `issues/` | The main corpus. Harness: `_matrix.ts` (provider matrix) + `prisma/_schema.ts` (templated schema) + `tests.ts`. Port postgres matrix entries; mongo entries where matrixed (e.g. `composites/`, mongo-tagged issues). Categories: core query/write methods (`methods/` 30, `raw-queries/` 15, `field-reference/` 15, `extended-where/` 14, `naming-conflict/` 10, `chunking-query/`, `distinct/`, `skip/`, `order-by-null/`, `default-selection/`, `fluent-api*/`, …), writes/batching/transactions (`batching*` family, `interactive-transactions/`, `optimistic-concurrency-control/`, `upsert*`, …), filters (`string-filters/`, `fulltext-search/`, `filter-count-relations/`), relations/referential actions (`relation-load-strategy*/`, `relationMode*/`, `multi-schema/`, `referentialActions-setDefault/`), scalars/types (`decimal/` 9, `enums/`, `enum-array/`, `json-fields/`, `json-null-types/`, `large-floats/`, `handle-int-overflow/`, `unixepoch-ms-datetime/`, `postgres_raw_query_parameter_types/`, `max_bind_value/`), extensions/client customization (`extensions/` 11, `omit/`, `globalOmit*/`), observability (`logging*/`, `tracing*/`, `query-error-logging/`), `typed-sql/` (21), `views/`, `0-legacy-ports/` (33), `composites/` (36, mongo) |
| Client functional regressions | `packages/client/tests/functional/issues/**` | 92 issue dirs / 297 files | Same harness; one dir per GitHub issue. High value: self-contained repros. |
| Migrate package tests | `packages/migrate/src/__tests__/*.test.ts` + `DbPull/` + `introspection/` | 34 files (`MigrateDev` 1794 lines, `MigrateDiff` 926, `DbExecute` 965, `DbPush` 455, `MigrateDeploy`, `MigrateReset`, `MigrateResolve`, `MigrateStatus`, `Baseline`, `DbSeed`, `DbDrop`, `listMigrations`, `rpc.test.ts`, `DbPull/{postgresql*,mongodb,…}` 11 files) | Real command classes against fixture projects (72 fixture dirs). Port `postgresOnly`/`mongodbOnly`/`describeMatrix`-postgres cases onto prisma-next CLI/Control API. SQLite-fixture cases → non-ported lines. |
| CLI package tests | `packages/cli/src/__tests__/**` | 21 files (`commands/{CLI,Version,Validate,Format,Generate,Status,DebugInfo,SubCommand}`, `Init.vitest.ts`, `incomplete-schemas.test.ts`, …) | Mostly DB-agnostic; port where a prisma-next CLI equivalent exists (`format`, `contract-emit`, validate-analog, init-journey); no-equivalent commands (e.g. `studio`, telemetry/update-check mechanics) → non-ported lines. |

### IN SCOPE — secondary

| Suite | Path | Volume | Notes |
| --- | --- | --- | --- |
| Legacy integration-tests package | `packages/integration-tests/src/__tests__/integration/{postgresql,sqlite,…}/` | 23 files (5 providers × scenarios + harness) | Small; port postgres scenarios not already covered by functional suites; check for unique introspection/runtime scenarios. |
| Legacy client integration | `packages/client/src/__tests__/integration/{happy,errors}/**` | 146 files (66 happy dirs, 29 error dirs) | Marked legacy upstream, superseded by functional tests. Port only cases with no functional-suite equivalent (notably `errors/` native-type / referential-action cases); cases whose behavior is identically covered by a ported functional test are marked `covered-by <target>` in the ledger rather than re-ported (exact ledger convention finalized in `plan.md`). |

### OUT OF SCOPE

| Suite | Path | Volume | Reason |
| --- | --- | --- | --- |
| Client e2e | `packages/client/tests/e2e/**` | 56 suite dirs | Bundler/packaging/runtime-infra tests (esbuild/webpack/Next/Workers/Deno/Bun tarball installs), not public-API query behavior; DB-touching minority duplicates functional coverage. |
| Client type tests | `packages/client/src/__tests__/types/**` | 97 files | Type-level (tsd) assertions on generated client types — not functional/runtime behavior. |
| Benchmarks | `packages/client/src/__tests__/benchmarks/**` | 12 files | Performance, not correctness. |
| Client unit tests | `packages/client/src/__tests__/*.test.ts` (root) | — | Internal-API unit tests. |
| Memory tests | `tests/memory` | absent in checkout | Directory does not exist at pinned SHA. |
| D1 e2e | `packages/migrate/src/__tests__/local-clouflare-d1-db-e2e.test.ts` | 1 file | Cloudflare D1-specific; unsupported target. |

## prisma/prisma-engines → `test/integration/test/ports/engines/`

### IN SCOPE — primary

| Suite | Path | Volume | Notes |
| --- | --- | --- | --- |
| Query-engine queries | `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/**` | 129 files (filters/ 50 incl. composite + field_reference, data_types/ 16, order_and_pagination/ 13, simple/ 13, aggregation/ 11, regressions/ 10, relations/ 6, batching/ 5) | `#[connector_test]` fns: schema fragment → GraphQL/JSON-protocol query → snapshot assertion. Port as ORM/`sql()` queries with explicit `toEqual` on equivalent results. Filter by connector tags: `only(Postgres)`/untagged → port; `only(MongoDb)` → mongo port; unsupported-connector-only → non-ported lines. |
| Query-engine writes | `…/tests/writes/**` | 111 files (data_types/ 22, nested_mutations/ 21, top_level_mutations/ 16, ids/ 14, relations/ 10, unchecked_writes/ 7, uniques_and_node_selectors/ 6, composites/ 5, regressions/ 5, filters/ 3) | Same pattern, write operations. |
| Query-engine new + regressions | `…/tests/new/**` | 71 files (regressions/ 42 issue-named files, ref_actions/ 13, native_types/ 2, relation_load_strategy/ 2, 12 top-level) | Issue repros are self-contained; prioritize. |
| Query-engine raw SQL | `…/tests/raw/sql/**` | 7 files (typed_output, errors, scalar_list, casts, input_coercion) | Ports onto `sql()` raw-SQL path. |
| Relation-link matrix tests | `#[relation_link_test]` across the crate | 185 macro invocations (expands to more cases) | Relation-topology matrix; port the postgres-applicable expansions. |
| SQL migration tests | `schema-engine/sql-migration-tests/tests/**` | 94 files / 775 `#[test_connector]` fns (migrations/ 61, existing_data/ 7, query_introspection/ 6, native_types/ 6, errors/ 3, create_migration/ 2, evaluate_data_loss/ 2, schema_push/ 2, apply_migrations/ 1, introspection/ 1, initialization/ 1, single_migration_tests data-dir) | Tests drive the exact JSON-RPC DTOs (`applyMigrations`, `createMigration`, `diff`, `schemaPush`, `evaluateDataLoss`, …) in-process — logically public-API. Port onto prisma-next migration CLI/Control API (`migration-new`, `migration-plan`, `migrate`, `db-update`, `migration-status`, journeys patterns). |
| Schema-engine CLI black-box | `schema-engine/cli/tests/cli_tests.rs` | 1 file / 25 fns | True JSON-RPC-over-stdio black-box tests (incl. error codes like `P4001`); port onto prisma-next CLI process-level tests (`cli.*.e2e` pattern). |
| Mongo schema connector | `schema-engine/connectors/mongodb-schema-connector/tests/**` | 17 files / 116 fns (migrations/scenarios/ ~30 data-driven fixtures, introspection/{index 51, types 35, basic 5, remapping 5, dirty_data 4, multi_file 12, …}) | Only Mongo migrate/introspect suite; runs on mongodb-memory-server. Data-driven scenarios port cleanly. |

### IN SCOPE — secondary

| Suite | Path | Volume | Notes |
| --- | --- | --- | --- |
| SQL introspection tests | `schema-engine/sql-introspection-tests/tests/**` | 84 files / 584 fns | Same logical shape as the public `introspect` RPC. Port `postgres/` (7) + provider-agnostic dirs (`tables/` 6, `relations/` 6, `relations_with_compound_fk/` 6, `re_introspection/` 12, `commenting_out/` 6, `enums/` 5, `views/` 5, `remapping_database_names/` 5, `named_constraints/` 4, `referential_actions/` 4, `multi_schema/` 4, `native_types/` 4, `model_renames/`, `lists/`, `simple/` data-dir) against prisma-next `db-schema`/introspection surface — verify feature parity per batch; `mysql/`, `mssql/`, `cockroachdb/` → non-ported lines. |

### OUT OF SCOPE

| Suite | Path | Volume | Reason |
| --- | --- | --- | --- |
| Sharding tests | `…/query-engine-tests/tests/sharding/**` | 5 files | Vitess/PlanetScale-specific; unsupported target. |
| SQL schema describer | `schema-engine/sql-schema-describer/tests/**` | 8 files / 70 fns | Internal Rust API (`SqlSchema` struct), no public-protocol boundary. |
| Driver-adapter executor | `libs/driver-adapters/executor/**` | — | Harness infrastructure (alternate execution backend), not a test suite; useful only as reference. |
| Query-engine black-box HTTP | (absent) | — | No standalone query-engine server binary/black-box crate exists at pinned SHA. |

> **Authoritative per-test counts now live in [`checklists/`](./checklists/README.md)** — 6,304 tests enumerated one checkbox line each from the pinned checkouts. The totals below were pre-enumeration estimates and undercount macro-expanded, `testIf`-gated, and data-driven cases.

## Totals

| | In-scope candidates (pre connector-filter) |
| --- | --- |
| prisma/prisma | ~740 functional files (incl. 297 regression files) + 34 migrate + 21 CLI + ~169 secondary legacy files |
| prisma-engines | ~1,672 `connector_test` + 185 `relation_link_test` + 775 migration + 584 introspection + 116 mongo + 25 CLI test fns (~537 files) |

Connector filtering (postgres/mongo-applicable only) will shrink the engines set to an estimated half to two-thirds; the exact per-test verdicts are produced batch-by-batch and recorded in the ledger — with unsupported-provider tests receiving individual `non-ported.md` lines per the spec's accounting rules.
