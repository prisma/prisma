# Checklist — prisma-engines schema-engine CLI (JSON-RPC black-box)

Source: prisma/prisma-engines@e922089b7d7502aff4249d5da3420f6fa55fc6ad — schema-engine/cli/tests/cli_tests.rs

Protocol: each line is one source test. `[ ]` = not yet dispositioned. The Opus reviewer sub-agent checks `[x]` ONLY when satisfied that the test is (a) faithfully ported and passing, (b) faithfully ported as `test.fails` with a `failing.md` entry, or (c) covered by a justified individual `non-ported.md` entry. Implementer sub-agents never check boxes.

### schema-engine/cli/tests/cli_tests.rs

- [ ] `cli_tests::test_connecting_with_a_working_mysql_connection_string` — CLI `can-connect-to-database`; asserts process success and stderr "Connection successful" [connectors: tags:mysql]
- [ ] `cli_tests::test_connecting_with_a_non_working_mysql_connection_string` — CLI `can-connect-to-database` against a non-existent database path; asserts exit code 1 and error_code P1003 [connectors: tags:mysql]
- [ ] `cli_tests::test_connecting_with_a_working_postgres_connection_string` — CLI `can-connect-to-database` with `postgres://` scheme URL; asserts success and "Connection successful" [connectors: tags:postgres]
- [ ] `cli_tests::test_connecting_with_a_working_postgresql_connection_string` — CLI `can-connect-to-database` with `postgresql://` scheme URL; asserts success and "Connection successful" [connectors: tags:postgres]
- [ ] `cli_tests::test_connecting_with_a_non_working_psql_connection_string` — CLI `can-connect-to-database` against a non-existent database; asserts exit code 1 and error_code P1003 [connectors: tags:postgres]
- [ ] `cli_tests::test_connecting_with_a_working_mssql_connection_string` — CLI `can-connect-to-database`; asserts success and "Connection successful" [connectors: tags:mssql]
- [ ] `cli_tests::test_create_database` — CLI `drop-database` then `create-database` then `can-connect-to-database`; asserts success and "was successfully created" message [connectors: tags:postgres,mysql]
- [ ] `cli_tests::test_create_database_mssql` — CLI `drop-database`/`create-database`/`can-connect-to-database` on a renamed mssql db; asserts "was successfully created" message [connectors: tags:mssql]
- [ ] `cli_tests::test_sqlite_url` — CLI `can-connect-to-database` with a bare sqlite path (no `file:` scheme); asserts failure and invalid-scheme error message [connectors: tags:sqlite]
- [ ] `cli_tests::test_create_sqlite_database` — CLI `create-database` for a `file:` sqlite path in a non-existent directory; asserts success and the .db file is created [connectors: tags:sqlite]
- [ ] `cli_tests::test_drop_sqlite_database` — CLI `create-database`/`can-connect-to-database`/`drop-database`; asserts the sqlite file is removed after drop [connectors: tags:sqlite]
- [ ] `cli_tests::test_drop_database` — CLI `drop-database` then `can-connect-to-database`; asserts exit code 1 and DatabaseDoesNotExist error code [connectors: tags:postgres,mysql]
- [ ] `cli_tests::test_drop_sqlserver_database` — CLI `create-database`/`drop-database`/`can-connect-to-database` on a NEWDATABASE mssql db; asserts DatabaseDoesNotExist after drop [connectors: tags:mssql]
- [ ] `cli_tests::bad_postgres_url_must_return_a_good_error` — CLI `create-database` with a malformed-port postgres URL; asserts exit code 1, error_code P1013, "invalid port number" [connectors: tags:postgres]
- [ ] `cli_tests::database_already_exists_must_return_a_proper_error` — CLI `create-database` on an already-existing database; asserts exit code 1, error_code P1009, "already exists" message [connectors: tags:postgres]
- [ ] `cli_tests::tls_errors_must_be_mapped_in_the_cli` — CLI `can-connect-to-database` with `sslmode=require&sslaccept=strict`; asserts exit code 1, error_code P1011, TLS handshake error [connectors: tags:postgres]
- [ ] `cli_tests::basic_jsonrpc_roundtrip_works_with_no_params` — spawns the engine over stdio and sends `getDatabaseVersion` JSON-RPC (no params) twice; asserts response contains PostgreSQL/CockroachDB [connectors: tags:postgres]
- [ ] `cli_tests::basic_jsonrpc_roundtrip_works_with_params` — stdio `getDatabaseVersion` JSON-RPC with Schema and ConnectionString datasource params; asserts version response each iteration [connectors: tags:postgres]
- [ ] `cli_tests::introspect_sqlite_empty_database` — stdio `introspect` JSON-RPC on an empty sqlite db; asserts P4001 "introspected database was empty" error envelope [connectors: n/a (plain #[test])]
- [ ] `cli_tests::introspect_sqlite_invalid_empty_database` — stdio `introspect` JSON-RPC with compositeTypeDepth -1 on an empty sqlite db; asserts P4001 empty-database error via expect snapshot [connectors: n/a (plain #[test])]
- [ ] `cli_tests::execute_postgres` — CLI `drop-database`/`create-database` then stdio `dbExecute` JSON-RPC running "SELECT 1;"; asserts result null [connectors: tags:postgres]
- [ ] `cli_tests::introspect_single_postgres_force` — drop/create db, `dbExecute` creates table+view, then single-file `introspect` force; asserts introspected schema with model A and view B [connectors: tags:postgres; exclude:cockroachdb; preview:views]
- [ ] `cli_tests::introspect_multi_postgres_force` — drop/create db, `dbExecute` creates table+view, then multi-file `introspect` force; asserts introspected.prisma output with model A [connectors: tags:postgres; exclude:cockroachdb; preview:views]
- [ ] `cli_tests::introspect_e2e` — stdio `introspect` JSON-RPC on an empty sqlite db (TODO placeholder); asserts datamodel result envelope [connectors: n/a (plain #[test]); ignored]
- [ ] `cli_tests::get_database_version_multi_file` — stdio `getDatabaseVersion` JSON-RPC with multi-file Schema and ConnectionString datasource params; asserts version response [connectors: tags:postgres]
- [ ] `cli_tests::test_missing_datasource_url_gives_proper_error` — CLI `can-connect-to-database` with a datasource that has no url; asserts exit code 1 and "No URL defined in the configured datasource" [connectors: n/a (tokio::test)]

**Total: 26 tests**
