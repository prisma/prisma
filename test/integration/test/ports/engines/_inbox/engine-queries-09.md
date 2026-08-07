## filters/field_reference/bigint_filter.rs

PASS `test/ports/engines/queries/filters/field_reference/bigint_filter/bigint_filter.test.ts` › `basic_where` — bigint equality and negated equality against a referenced bigint field
PASS `test/ports/engines/queries/filters/field_reference/bigint_filter/bigint_filter.test.ts` › `numeric_comparison_filters` — bigint order comparisons and their negations against a referenced bigint field
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/field_reference/bigint_filter.rs` › `queries::filters::field_reference::bigint_filter::inclusion_filter` — bigint scalar membership in a referenced bigint-list field — prisma-next has no public contract-bound scalar-in-array-column field-reference operator; ORM `in`/`notIn` accept literal lists
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/field_reference/bigint_filter.rs` › `queries::filters::field_reference::bigint_filter::scalar_list_filters` — bigint-list has/hasSome/hasEvery against referenced scalar/list fields — prisma-next's public list predicates do not accept referenced columns as operands

## filters/field_reference/bytes_filter.rs

PASS `test/ports/engines/queries/filters/field_reference/bytes_filter/bytes_filter.test.ts` › `basic_where` — bytes equality and negated equality against a referenced bytes field
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/field_reference/bytes_filter.rs` › `queries::filters::field_reference::bytes_filter::inclusion_filter` — bytes scalar membership in a referenced bytes-list field — prisma-next has no public contract-bound scalar-in-array-column field-reference operator; ORM `in`/`notIn` accept literal lists
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/field_reference/bytes_filter.rs` › `queries::filters::field_reference::bytes_filter::scalar_list_filters` — bytes-list has/hasSome/hasEvery against referenced scalar/list fields — prisma-next's public list predicates do not accept referenced columns as operands

## filters/field_reference/composite_filter.rs

- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/field_reference/composite_filter.rs` › `queries::filters::field_reference::composite_filter::composite_equality` — embedded composite equality and inequality against another field in the same composite — prisma-next's Mongo ORM has no embedded-composite field-reference predicate surface
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/field_reference/composite_filter.rs` › `queries::filters::field_reference::composite_filter::list_equality` — embedded-composite-list some/every/none predicates against another field in each composite — prisma-next's Mongo ORM has neither embedded-list quantifier filters nor embedded field-reference operands

## filters/field_reference/datetime_filter.rs

PASS `test/ports/engines/queries/filters/field_reference/datetime_filter/datetime_filter.test.ts` › `basic_where` — datetime equality and negated equality against a referenced datetime field
PASS `test/ports/engines/queries/filters/field_reference/datetime_filter/datetime_filter.test.ts` › `numeric_comparison_filters` — datetime order comparisons and their negations against a referenced datetime field
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/field_reference/datetime_filter.rs` › `queries::filters::field_reference::datetime_filter::inclusion_filter` — datetime scalar membership in a referenced datetime-list field — prisma-next has no public contract-bound scalar-in-array-column field-reference operator; ORM `in`/`notIn` accept literal lists
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/field_reference/datetime_filter.rs` › `queries::filters::field_reference::datetime_filter::scalar_list_filters` — datetime-list has/hasSome/hasEvery against referenced scalar/list fields — prisma-next's public list predicates do not accept referenced columns as operands

## filters/field_reference/decimal_filter.rs

PASS `test/ports/engines/queries/filters/field_reference/decimal_filter/decimal_filter.test.ts` › `basic_where` — decimal equality and negated equality against a referenced decimal field
PASS `test/ports/engines/queries/filters/field_reference/decimal_filter/decimal_filter.test.ts` › `numeric_comparison_filters` — decimal order comparisons and their negations against a referenced decimal field
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/field_reference/decimal_filter.rs` › `queries::filters::field_reference::decimal_filter::inclusion_filter` — decimal scalar membership in a referenced decimal-list field — prisma-next has no public contract-bound scalar-in-array-column field-reference operator; ORM `in`/`notIn` accept literal lists
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/field_reference/decimal_filter.rs` › `queries::filters::field_reference::decimal_filter::scalar_list_filters` — decimal-list has/hasSome/hasEvery against referenced scalar/list fields — prisma-next's public list predicates do not accept referenced columns as operands

## filters/field_reference/enum_filter.rs

- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/field_reference/enum_filter.rs` › `queries::filters::field_reference::enum_filter::inclusion_filter` — enum scalar membership and non-membership in a referenced enum-list field — prisma-next has no public contract-bound scalar-in-array-column field-reference operator; ORM `in`/`notIn` accept literal lists

## filters/field_reference/failure.rs

PASS `test/ports/engines/queries/filters/field_reference/failure/failure.test.ts` › `unknown_field_name_fails` — an unknown referenced scalar column rejects the query
PASS `test/ports/engines/queries/filters/field_reference/failure/failure.test.ts` › `fields_of_different_models_fails` — a referenced scalar column from another model rejects the query
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/field_reference/failure.rs` › `queries::filters::field_reference::failure::fields_of_different_container_fails` — a model filter referencing a field inside a Mongo composite rejects validation — prisma-next's Mongo ORM has no composite field-reference input surface on which to express the invalid cross-container reference
PASS `test/ports/engines/queries/filters/field_reference/failure/failure.test.ts` › `relation_field_name_fails` — referencing a relation name where a scalar column is required rejects the query
PASS `test/ports/engines/queries/filters/field_reference/failure/failure.test.ts` › `fields_of_different_type_fails` — scalar and relation filters reject referenced columns of a different scalar type
PASS `test/ports/engines/queries/filters/field_reference/failure/failure.test.ts` › `field_of_different_arity_fails` — scalar and relation filters reject referenced list columns where scalar columns are required
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/field_reference/failure.rs` › `queries::filters::field_reference::failure::field_ref_inclusion_filter_fails` — connectors without scalar-list support reject field references in in/notIn — the source explicitly excludes PostgreSQL and MongoDB, leaving only unsupported target connectors
PASS `test/ports/engines/queries/filters/field_reference/failure/failure.test.ts` › `field_ref_in_having_must_be_selected` — grouped having rejects a referenced field that is not selected for grouping
PASS `test/ports/engines/queries/filters/field_reference/failure/failure.test.ts` › `count_expect_int_field_ref` — grouped count accepts an Int referenced field and rejects a String referenced field
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/field_reference/failure.rs` › `queries::filters::field_reference::failure::json_string_expect_string_field_ref` — JSON contains/endsWith/startsWith reject a JSON referenced field where String is required — prisma-next has no public JSON string-filter field-reference operations
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/field_reference/failure.rs` › `queries::filters::field_reference::failure::referencing_composite_field_fails` — directly referencing a Mongo composite field rejects validation — prisma-next's Mongo ORM has no composite field-reference input surface on which to express the invalid reference
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/field_reference/failure.rs` › `queries::filters::field_reference::failure::alphanumeric_json_filter_fails` — MySQL/MariaDB reject alphanumeric JSON field references — the source is MySQL-only and prisma-next's supported target connectors do not include MySQL
