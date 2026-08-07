## filters/field_reference/bigint_filter.rs

PASS `test/ports/engines/queries/filters/field_reference/bigint_filter/bigint_filter.test.ts` › `basic_where` — bigint equality and negated equality against a referenced bigint field
PASS `test/ports/engines/queries/filters/field_reference/bigint_filter/bigint_filter.test.ts` › `numeric_comparison_filters` — bigint order comparisons and their negations against a referenced bigint field
PASS `test/integration/test/ports/engines/queries/filters/field_reference/bigint_filter/bigint_filter.test.ts` › `inclusion_filter` — bigint membership and both negations use database-side `= ANY` against the referenced bigint-list column with null exclusion
PASS `test/integration/test/ports/engines/queries/filters/field_reference/bigint_filter/bigint_filter.test.ts` › `scalar_list_filters` — bigint-list has/hasSome/hasEvery and their negations use referenced columns with database-side `ANY`, overlap, and containment while excluding null and empty operands

## filters/field_reference/bytes_filter.rs

PASS `test/ports/engines/queries/filters/field_reference/bytes_filter/bytes_filter.test.ts` › `basic_where` — bytes equality and negated equality against a referenced bytes field
PASS `test/integration/test/ports/engines/queries/filters/field_reference/bytes_filter/bytes_filter.test.ts` › `inclusion_filter` — bytes membership and both negations use database-side `= ANY` against the referenced bytes-list column with null exclusion
PASS `test/integration/test/ports/engines/queries/filters/field_reference/bytes_filter/bytes_filter.test.ts` › `scalar_list_filters` — bytes-list has/hasSome/hasEvery and their negations use referenced columns with database-side `ANY`, overlap, and containment while excluding null and empty operands

## filters/field_reference/composite_filter.rs

- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/field_reference/composite_filter.rs` › `queries::filters::field_reference::composite_filter::composite_equality` — embedded composite equality and inequality against another field in the same composite — the exact Mongo schema requires domain field `id Int @id @map("_id")`; Mongo PSL rejects non-ObjectId `_id`, while the TS builder can author Int `_id` and value objects but has no field-storage mapping/id metadata that preserves domain field `id` mapped to `_id`; raw `$expr` field references do not resolve that schema mismatch
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/field_reference/composite_filter.rs` › `queries::filters::field_reference::composite_filter::list_equality` — embedded-composite-list some/every/none predicates against another field in each composite — the exact Mongo schema requires domain field `id Int @id @map("_id")`; Mongo PSL rejects non-ObjectId `_id`, while the TS builder cannot preserve the `id`-to-`_id` field mapping/id metadata even though it supports Int `_id`, value-object lists, and raw `$expr`/`$elemMatch` expressions

## filters/field_reference/datetime_filter.rs

PASS `test/ports/engines/queries/filters/field_reference/datetime_filter/datetime_filter.test.ts` › `basic_where` — datetime equality and negated equality against a referenced datetime field
PASS `test/ports/engines/queries/filters/field_reference/datetime_filter/datetime_filter.test.ts` › `numeric_comparison_filters` — datetime order comparisons and their negations against a referenced datetime field
PASS `test/integration/test/ports/engines/queries/filters/field_reference/datetime_filter/datetime_filter.test.ts` › `inclusion_filter` — datetime membership and both negations use database-side `= ANY` against the referenced datetime-list column with null exclusion
PASS `test/integration/test/ports/engines/queries/filters/field_reference/datetime_filter/datetime_filter.test.ts` › `scalar_list_filters` — datetime-list has/hasSome/hasEvery and their negations use referenced columns with database-side `ANY`, overlap, and containment while excluding null and empty operands

## filters/field_reference/decimal_filter.rs

PASS `test/ports/engines/queries/filters/field_reference/decimal_filter/decimal_filter.test.ts` › `basic_where` — decimal equality and negated equality against a referenced decimal field
PASS `test/ports/engines/queries/filters/field_reference/decimal_filter/decimal_filter.test.ts` › `numeric_comparison_filters` — decimal order comparisons and their negations against a referenced decimal field
PASS `test/integration/test/ports/engines/queries/filters/field_reference/decimal_filter/decimal_filter.test.ts` › `inclusion_filter` — decimal membership and both negations use database-side `= ANY` against the referenced decimal-list column with null exclusion
PASS `test/integration/test/ports/engines/queries/filters/field_reference/decimal_filter/decimal_filter.test.ts` › `scalar_list_filters` — decimal-list has/hasSome/hasEvery and their negations use referenced columns with database-side `ANY`, overlap, and containment while excluding null and empty operands

## filters/field_reference/enum_filter.rs

FAIL `test/integration/test/ports/engines/queries/filters/field_reference/enum_filter/enum_filter.test.ts` › `inclusion_filter` — enum membership reaches database-side `= ANY` over the faithful native-enum columns, but decoding the required full enum result shape fails because `materializeCodec` calls `PgEnumDescriptor.factory` without its receiver and produces a codec with no descriptor

## filters/field_reference/failure.rs

PASS `test/ports/engines/queries/filters/field_reference/failure/failure.test.ts` › `unknown_field_name_fails` — an unknown referenced scalar column rejects the query
PASS `test/ports/engines/queries/filters/field_reference/failure/failure.test.ts` › `fields_of_different_models_fails` — a referenced scalar column from another model rejects the query
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/field_reference/failure.rs` › `queries::filters::field_reference::failure::fields_of_different_container_fails` — a model filter referencing a field inside a Mongo composite rejects validation — the shared exact Mongo schema requires domain field `id Int @id @map("_id")`; PSL rejects its non-ObjectId `_id`, and TS authoring cannot preserve the `id`-to-`_id` mapping/id metadata, so the invalid cross-container query has no faithful schema on which to run
PASS `test/ports/engines/queries/filters/field_reference/failure/failure.test.ts` › `relation_field_name_fails` — referencing a relation name where a scalar column is required rejects the query
PASS `test/ports/engines/queries/filters/field_reference/failure/failure.test.ts` › `fields_of_different_type_fails` — scalar and relation filters reject referenced columns of a different scalar type
PASS `test/ports/engines/queries/filters/field_reference/failure/failure.test.ts` › `field_of_different_arity_fails` — scalar and relation filters reject referenced list columns where scalar columns are required
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/field_reference/failure.rs` › `queries::filters::field_reference::failure::field_ref_inclusion_filter_fails` — connectors without scalar-list support reject field references in in/notIn — the source explicitly excludes PostgreSQL, MongoDB, and CockroachDB; its remaining SQLite case is outside this project's no-SQLite corpus, and the other remaining providers are unsupported targets
PASS `test/ports/engines/queries/filters/field_reference/failure/failure.test.ts` › `field_ref_in_having_must_be_selected` — grouped having rejects a referenced field that is not selected for grouping
PASS `test/ports/engines/queries/filters/field_reference/failure/failure.test.ts` › `count_expect_int_field_ref` — grouped count accepts an Int referenced field and rejects a String referenced field
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/field_reference/failure.rs` › `queries::filters::field_reference::failure::json_string_expect_string_field_ref` — JSON contains/endsWith/startsWith reject a JSON referenced field where String is required — prisma-next has no public JSON string-filter field-reference operations
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/field_reference/failure.rs` › `queries::filters::field_reference::failure::referencing_composite_field_fails` — directly referencing a Mongo composite field rejects validation — the shared exact Mongo schema requires domain field `id Int @id @map("_id")`; PSL rejects its non-ObjectId `_id`, and TS authoring cannot preserve the `id`-to-`_id` mapping/id metadata, so the invalid composite-reference query has no faithful schema on which to run
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/field_reference/failure.rs` › `queries::filters::field_reference::failure::alphanumeric_json_filter_fails` — MySQL/MariaDB reject alphanumeric JSON field references — the source is MySQL-only and prisma-next's supported target connectors do not include MySQL
