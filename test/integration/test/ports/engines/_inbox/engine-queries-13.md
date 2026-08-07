## filters/many_relation.rs

PASS `test/ports/engines/queries/filters/many_relation/many_relation.test.ts` › `simple_scalar_filter` — filters nested posts by popularity in the database
PASS `test/ports/engines/queries/filters/many_relation/many_relation.test.ts` › `l1_1_rel` — filters posts through their to-one blog relation
PASS `test/ports/engines/queries/filters/many_relation/many_relation.test.ts` › `l1_m_rel_some` — exercises to-many some filters and AND combinations
PASS `test/ports/engines/queries/filters/many_relation/many_relation.test.ts` › `l1_m_rel_every` — exercises to-many every filters
PASS `test/ports/engines/queries/filters/many_relation/many_relation.test.ts` › `l1_m_rel_none` — exercises to-many none filters
PASS `test/ports/engines/queries/filters/many_relation/many_relation.test.ts` › `l2_m_rel_some_some` — composes two levels of some relation filters
PASS `test/ports/engines/queries/filters/many_relation/many_relation.test.ts` › `l2_m_rel_all` — covers every two-level some/every/none combination
PASS `test/ports/engines/queries/filters/many_relation/many_relation.test.ts` › `l2_m_1_rel_all` — combines to-many quantifiers with optional to-one relation predicates
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/many_relation.rs` › `queries::filters::many_relation::crazy_filters` — combined relation filters plus Prisma string contains — prisma-next has no contains operator, and substituting like would change escaping semantics
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/many_relation.rs` › `queries::filters::many_relation::m2m_join_relation_1level` — M:N relation filter combined with startsWith and endsWith — prisma-next has neither string operator, and like substitution is forbidden
PASS `test/ports/engines/queries/filters/many_relation/many_relation.test.ts` › `prisma_25103` — filters nested subscriptions by nullable fields and a related audience
PASS `test/ports/engines/queries/filters/many_relation/many_relation.test.ts` › `prisma_25104` — filters a nested M:N relation with every
PASS `test/ports/engines/queries/filters/many_relation/many_relation.test.ts` › `prisma_23742` — filters nested M:N bottoms through tops using the source ids
PASS `test/ports/engines/queries/filters/many_relation/many_relation.test.ts` › `nested_some_filter_m2m_different_pk` — filters nested M:N relations whose primary-key field names differ

## filters/one2one_regression.rs

PASS `test/ports/engines/queries/filters/one2one_regression/one2one_regression.test.ts` › `work_with_nulls` — self 1:1 friend and inverse relation null filtering

## filters/one_relation.rs

PASS `test/ports/engines/queries/filters/one_relation/one_relation.test.ts` › `basic_scalar` — scalar equality filter on Post
PASS `test/ports/engines/queries/filters/one_relation/one_relation.test.ts` › `l1_one_rel` — to-one is/isNot and null relation filters
PASS `test/ports/engines/queries/filters/one_relation/one_relation.test.ts` › `l1_one_rel_shorthands` — shorthand-equivalent to-one and null filters
PASS `test/ports/engines/queries/filters/one_relation/one_relation.test.ts` › `l2_one_rel` — two-level optional to-one relation filtering
PASS `test/ports/engines/queries/filters/one_relation/one_relation.test.ts` › `nested_to_one_filter` — database-side filters on an included to-one relation
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/one_relation.rs` › `queries::filters::one_relation::nested_req_to_one_filter_should_fail` — query-engine GraphQL rejects a where argument on a required to-one selection with protocol error 2009 — prisma-next has no GraphQL protocol validation surface or equivalent enclosing-type error
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/one_relation.rs` › `queries::filters::one_relation::crazy_filters` — deeply nested relation filtering combined with Prisma contains — prisma-next has no contains operator and like is not equivalent
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/one_relation.rs` › `queries::filters::one_relation::one2one_join_relation_1level` — 1:1 relation query combined with startsWith and endsWith — prisma-next lacks both exact string operators
PASS `test/ports/engines/queries/filters/one_relation/one_relation.test.ts` › `repro_21356` — relation some through a compound foreign key
PASS `test/ports/engines/queries/filters/one_relation/one_relation.test.ts` › `repro_21366` — relation some through a unique non-primary referenced field

## filters/ported_filters.rs

- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/ported_filters.rs` › `queries::filters::ported_filters::l1_and` — top-level AND combines startsWith and endsWith — prisma-next lacks both exact string operators
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/ported_filters.rs` › `queries::filters::ported_filters::l2_and` — nested AND combines startsWith and endsWith — prisma-next lacks both exact string operators
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/ported_filters.rs` › `queries::filters::ported_filters::l1_or` — top-level OR includes startsWith and endsWith branches — prisma-next lacks both exact string operators
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/ported_filters.rs` › `queries::filters::ported_filters::l2_or` — nested OR includes startsWith and endsWith branches — prisma-next lacks both exact string operators
PASS `test/ports/engines/queries/filters/ported_filters/ported_filters.test.ts` › `filter_null` — null equality, negation, nested negation, and null-in semantics with relation predicates
PASS `test/ports/engines/queries/filters/ported_filters/ported_filters.test.ts` › `str_eq` — string equality with and without a relation predicate
PASS `test/ports/engines/queries/filters/ported_filters/ported_filters.test.ts` › `str_not_eq` — negated string equality with and without a relation predicate
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/ported_filters.rs` › `queries::filters::ported_filters::str_contains` — Prisma contains filtering — prisma-next has no contains operator and like is not equivalent
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/ported_filters.rs` › `queries::filters::ported_filters::str_not_contains` — negated Prisma contains filtering — prisma-next has no contains operator and like is not equivalent
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/ported_filters.rs` › `queries::filters::ported_filters::str_starts_with` — Prisma startsWith filtering — prisma-next has no startsWith operator and like is not equivalent
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/ported_filters.rs` › `queries::filters::ported_filters::str_not_starts_with` — negated Prisma startsWith filtering — prisma-next has no startsWith operator and like is not equivalent
