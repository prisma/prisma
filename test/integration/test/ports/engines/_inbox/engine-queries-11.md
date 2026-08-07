## queries/filters/filter_regression.rs

PASS `test/integration/test/ports/engines/queries/filters/filter_regression/filter_regression.test.ts` › `work_with_nulls (one-to-many)` — nullable one-to-many none/every and optional to-one is relation filters
PASS `test/integration/test/ports/engines/queries/filters/filter_regression/filter_regression.test.ts` › `work_with_nulls (compound one-to-many)` — nullable one-to-many none/every filters through a compound foreign key
PASS `test/integration/test/ports/engines/queries/filters/filter_regression/filter_regression.test.ts` › `work_with_nulls (many-to-many)` — nullable many-to-many none/every relation filters through the faithful explicit junction translation

## queries/filters/filter_unwrap.rs

- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/filter_unwrap.rs` › `queries::filters::filter_unwrap::many_filter` — nested deleteMany with an in filter on child rows — prisma-next's public nested mutation surface has no deleteMany operation

## queries/filters/filters.rs

PASS `test/integration/test/ports/engines/queries/filters/filters/filters.test.ts` › `no_filter` — empty find-many filters return every row for each model
PASS `test/integration/test/ports/engines/queries/filters/filters/filters.test.ts` › `simple` — nullable string equality filter
PASS `test/integration/test/ports/engines/queries/filters/filters/filters.test.ts` › `inverted_simple` — logical NOT around a nullable string equality filter
PASS `test/integration/test/ports/engines/queries/filters/filters/filters.test.ts` › `implicit_not_equals` — scalar not-equals filter
PASS `test/integration/test/ports/engines/queries/filters/filters/filters.test.ts` › `implicit_equals` — shorthand scalar equality filter
PASS `test/integration/test/ports/engines/queries/filters/filters/filters.test.ts` › `implicit_equals_null` — shorthand null equality filter
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/filters.rs` › `queries::filters::filters::in_null` — null passed as the operand of an in filter — prisma-next's in operator requires a list and has no null-operand/no-op input form
PASS `test/integration/test/ports/engines/queries/filters/filters/filters.test.ts` › `in_list` — nullable string membership filter
PASS `test/integration/test/ports/engines/queries/filters/filters/filters.test.ts` › `not_in_list` — nullable string exclusion filter
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/filters.rs` › `queries::filters::filters::not_in_null` — null passed as the operand of a notIn filter — prisma-next's notIn operator requires a list and has no null-operand/no-op input form
PASS `test/integration/test/ports/engines/queries/filters/filters/filters.test.ts` › `relation_null` — optional to-one relation absence filter
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/filters.rs` › `queries::filters::filters::and` — AND combines a numeric condition with startsWith — prisma-next has no startsWith operator and substituting like would change escaping semantics
PASS `test/integration/test/ports/engines/queries/filters/filters/filters.test.ts` › `empty_and` — an empty AND expression is true
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/filters.rs` › `queries::filters::filters::or` — OR combines a numeric condition with startsWith — prisma-next has no startsWith operator and substituting like would change escaping semantics
PASS `test/integration/test/ports/engines/queries/filters/filters/filters.test.ts` › `empty_or` — an empty OR expression is false
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/filters.rs` › `queries::filters::filters::empty_not` — list-valued NOT with an empty input returns every row — prisma-next's public not helper accepts one expression and has no list-valued NOT input whose empty-list semantics can be exercised
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/filters.rs` › `queries::filters::filters::not` — NOT negates startsWith — prisma-next has no startsWith operator and substituting like would change the subject
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/filters.rs` › `queries::filters::filters::not_not` — nested NOT negates startsWith twice — prisma-next has no startsWith operator and substituting like would change the subject
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/filters.rs` › `queries::filters::filters::not_list` — list-valued NOT combines contains with equality — prisma-next has neither the contains operator nor a list-valued NOT input
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/filters.rs` › `queries::filters::filters::nested_filter` — startsWith inside a to-one relation filter — prisma-next has relation filters but no startsWith operator, and like is not equivalent
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/filters.rs` › `queries::filters::filters::starts_with` — startsWith string filtering — prisma-next has no startsWith operator and like has different metacharacter semantics
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/filters.rs` › `queries::filters::filters::contains` — contains string filtering — prisma-next has no contains operator and like has different metacharacter semantics
PASS `test/integration/test/ports/engines/queries/filters/filters/filters.test.ts` › `greater_than` — high-precision floating-point greater-than filter
PASS `test/integration/test/ports/engines/queries/filters/filters/filters.test.ts` › `inverted_null` — not-null filter on an optional field
FAIL `test/integration/test/ports/engines/queries/filters/filters/filters.test.ts` › `inverted_null_required` — null operand for not on a required field is rejected — prisma-next type-rejects the operand but lowers it to IS NOT NULL at runtime instead of rejecting the request

## queries/filters/insensitive_filters.rs

- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/insensitive_filters.rs` › `queries::filters::insensitive_filters::string_matchers` — case-insensitive startsWith, endsWith, and contains — prisma-next has none of these operators or their insensitive modes; ilike is not equivalent
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/insensitive_filters.rs` › `queries::filters::insensitive_filters::neg_string_matchers` — negated case-insensitive startsWith, endsWith, and contains — prisma-next has none of these operators or their insensitive modes
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/insensitive_filters.rs` › `queries::filters::insensitive_filters::numeric_matchers` — case-insensitive gt/gte/lt/lte string comparisons and negations — prisma-next's ordered string comparisons expose no insensitive mode
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/insensitive_filters.rs` › `queries::filters::insensitive_filters::comparator_ops` — case-insensitive equality and ordered comparisons under PostgreSQL collation — prisma-next's equality and ordered comparisons expose no insensitive mode
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/insensitive_filters.rs` › `queries::filters::insensitive_filters::list_containment_ops` — case-insensitive in and notIn string membership — prisma-next's in/notIn operations expose no insensitive mode

## queries/filters/insensitive_json_filters.rs

- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/insensitive_json_filters.rs` › `queries::filters::insensitive_json_filters::string_matcher` — case-insensitive equality at a JSON path — prisma-next has no JSON-path filter surface or insensitive JSON comparator

## queries/filters/json.rs

- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/json.rs` › `queries::filters::json::basic` — JSON equality/not-equality plus SQL-null exclusion — prisma-next's JSON codec exposes no equality trait, so both shorthand equality and comparison-method equality are rejected
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/json.rs` › `queries::filters::json::basic_null_eq` — distinct DbNull, JsonNull, and AnyNull equality inputs — prisma-next has no JSON null sentinels and cannot distinguish these three input forms
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/json.rs` › `queries::filters::json::basic_not_null_eq` — negated distinct DbNull, JsonNull, and AnyNull equality inputs — prisma-next has no JSON null sentinels and cannot express the three predicates faithfully
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/json.rs` › `queries::filters::json::req_json_null_filters` — required JSON null-sentinel filters plus DbNull create rejection — prisma-next has no DbNull/JsonNull/AnyNull input sentinels
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/json.rs` › `queries::filters::json::basic_null_eq_defaults` — JsonNull and AnyNull filters against a JSON default — prisma-next has no JSON null sentinels
FAIL `test/integration/test/ports/engines/queries/filters/json/json.test.ts` › `no_shorthands` — JSON object and null shorthand filters are both rejected — prisma-next rejects object shorthand because JSON lacks equality but accepts null shorthand as an SQL-null filter
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/json.rs` › `queries::filters::json::nested_not_shorthand` — GraphQL input validation rejects nested JSON not/equality objects — prisma-next has no GraphQL query-input validation surface, and this case excludes the PostgreSQL connector
