## queries/aggregation/group_by_having.rs

PASS `test/integration/test/ports/engines/queries/aggregation/group_by_having/group_by_having.test.ts` › `basic_having_scalar_filter` — grouped scalar-field HAVING predicates preserve both grouping keys and aggregate results
PASS `test/integration/test/ports/engines/queries/aggregation/group_by_having/group_by_having.test.ts` › `having_count_scalar_filter` — field-specific non-null counts support equals, not-equals, and inclusion predicates
PASS `test/integration/test/ports/engines/queries/aggregation/group_by_having/group_by_having.test.ts` › `having_sum_scalar_filter` — optional numeric sums support equals, not-equals, and inclusion predicates for float and int fields
PASS `test/integration/test/ports/engines/queries/aggregation/group_by_having/group_by_having.test.ts` › `having_min_scalar_filter` — optional numeric minima support equals, not-equals, and inclusion predicates for float and int fields
PASS `test/integration/test/ports/engines/queries/aggregation/group_by_having/group_by_having.test.ts` › `having_max_scalar_filter` — optional numeric maxima support equals, not-equals, and inclusion predicates for float and int fields
PASS `test/integration/test/ports/engines/queries/aggregation/group_by_having/group_by_having.test.ts` › `having_count_non_numerical_field` — HAVING counts non-null string values and filters groups by that count
PASS `test/integration/test/ports/engines/queries/aggregation/group_by_having/group_by_having.test.ts` › `having_without_aggr_sel` — aggregate HAVING predicates filter a projection containing only the grouping key
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/aggregation/group_by_having.rs` › `queries::aggregation::group_by_having::having_filter_mismatch_selection` — reject a non-aggregate HAVING field omitted from the group selection — prisma-next's grouped API always returns every declared grouping key and exposes no invalid selection shape equivalent to this protocol validation error
PASS `test/integration/test/ports/engines/queries/aggregation/group_by_having/group_by_having.test.ts` › `having_avg_scalar_filter` — decimal average HAVING equality selects only group1 and returns its average
PASS `test/integration/test/ports/engines/queries/aggregation/group_by_having/group_by_having.test.ts` › `decimal having_sum_scalar_filter` — decimal sums support equals, not-equals, and inclusion predicates
PASS `test/integration/test/ports/engines/queries/aggregation/group_by_having/group_by_having.test.ts` › `decimal having_min_scalar_filter` — decimal minima support equals, not-equals, and inclusion predicates
PASS `test/integration/test/ports/engines/queries/aggregation/group_by_having/group_by_having.test.ts` › `decimal having_max_scalar_filter` — decimal maxima support equals, not-equals, and inclusion predicates

## queries/aggregation/many_count_relation.rs

PASS `test/integration/test/ports/engines/queries/aggregation/many_count_relation/many_count_relation.test.ts` › `no_rel_records` — counts empty one-to-many and many-to-many relations as zero
PASS `test/integration/test/ports/engines/queries/aggregation/many_count_relation/many_count_relation.test.ts` › `count_one2m_m2m` — counts one-to-many and many-to-many relations for two posts
PASS `test/integration/test/ports/engines/queries/aggregation/many_count_relation/many_count_relation.test.ts` › `count_with_cursor` — relation cursor/take shapes returned rows without changing the independent total relation count
PASS `test/integration/test/ports/engines/queries/aggregation/many_count_relation/many_count_relation.test.ts` › `count_with_take` — relation take shapes returned rows without changing the independent total relation count
PASS `test/integration/test/ports/engines/queries/aggregation/many_count_relation/many_count_relation.test.ts` › `count_with_skip` — relation skip shapes returned rows without changing the independent total relation count
PASS `test/integration/test/ports/engines/queries/aggregation/many_count_relation/many_count_relation.test.ts` › `count_with_filters` — relation filters shape returned rows without changing the independent total relation count
PASS `test/integration/test/ports/engines/queries/aggregation/many_count_relation/many_count_relation.test.ts` › `count_with_distinct` — relation distinct shapes returned rows without changing the independent total relation count
PASS `test/integration/test/ports/engines/queries/aggregation/many_count_relation/many_count_relation.test.ts` › `nested_count_one2m_m2m` — nested one-to-many and many-to-many relation rows carry independent counts at every selected level
PASS `test/integration/test/ports/engines/queries/aggregation/many_count_relation/many_count_relation.test.ts` › `nested_count_same_field_on_many_levels` — the same comments relation is counted at parent and nested parent levels while row filters remain independent
PASS `test/integration/test/ports/engines/queries/aggregation/many_count_relation/many_count_relation.test.ts` › `count_m_n_self_rel` — self many-to-many followers and following rows and counts are correct for list and unique reads
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/aggregation/many_count_relation.rs` › `queries::aggregation::many_count_relation::works_with_inmemory_args_processing` — query-engine relation-count extraction after its internal in-memory cursor/skip/take processing — prisma-next has no query-engine in-memory argument-processing mechanism; recreating the result with its database-side collection pipeline would test a different subject
PASS `test/integration/test/ports/engines/queries/aggregation/many_count_relation/many_count_relation.test.ts` › `count_one2m_compound_ids` — relation count works through a compound-id parent and multi-column foreign key
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/aggregation/many_count_relation.rs` › `queries::aggregation::many_count_relation::count_one2m_compound_ids_cockroachdb` — CockroachDB BigInt compound-id relation count variant — source case is CockroachDB-only and prisma-next's supported port databases are PostgreSQL and MongoDB
PASS `test/integration/test/ports/engines/queries/aggregation/many_count_relation/many_count_relation.test.ts` › `count_one2m_dup_child_id` — duplicated parent rows reached through children retain the full child relation count
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/aggregation/many_count_relation.rs` › `queries::aggregation::many_count_relation::filtered_count_one2m_m2m` — filtered relation counts combined with ordering and cursor by relation aggregate count — prisma-next supports filtered relation counts but has no public relation-aggregate `orderBy`, so the source case's four-query assertion set cannot be expressed
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/aggregation/many_count_relation.rs` › `queries::aggregation::many_count_relation::filtered_count_composite` — MongoDB filtered relation count through an embedded composite predicate — the Mongo ORM has reference includes but no relation-count aggregate/refinement surface
PASS `test/integration/test/ports/engines/queries/aggregation/many_count_relation/many_count_relation.test.ts` › `regression_nullable_count_libsql` — nullable relation-count results are coalesced to zero

## queries/aggregation/max.rs

PASS `test/integration/test/ports/engines/queries/aggregation/max/max.test.ts` › `max_no_records` — empty common scalar input returns null maxima
PASS `test/integration/test/ports/engines/queries/aggregation/max/max.test.ts` › `max_some_records` — common string and numeric scalar maxima match the source values
FAIL `test/integration/test/ports/engines/queries/aggregation/max/max.test.ts` › `max_with_all_sorts_of_query_args` — maximum after take, negative take, skip, where, and cursor input shaping on the common scalar schema — prisma-next's top-level aggregate compilation drops take, negative take, skip, and cursor state, so those maxima include all rows
PASS `test/integration/test/ports/engines/queries/aggregation/max/max.test.ts` › `decimal max_no_records` — empty decimal input returns a null maximum
PASS `test/integration/test/ports/engines/queries/aggregation/max/max.test.ts` › `decimal max_some_records` — decimal maximum matches the source value using prisma-next's Numeric string representation
FAIL `test/integration/test/ports/engines/queries/aggregation/max/max.test.ts` › `decimal max_with_all_sorts_of_query_args` — decimal maximum after take, negative take, skip, where, and cursor input shaping — prisma-next's top-level aggregate compilation drops take, negative take, skip, and cursor state, so those maxima include all rows

## queries/aggregation/min.rs

PASS `test/integration/test/ports/engines/queries/aggregation/min/min.test.ts` › `min_no_records` — empty common scalar input returns null minima
PASS `test/integration/test/ports/engines/queries/aggregation/min/min.test.ts` › `min_some_records` — common string and numeric scalar minima match the source values
FAIL `test/integration/test/ports/engines/queries/aggregation/min/min.test.ts` › `min_with_all_sorts_of_query_args` — minimum after take, negative take, skip, where, and cursor input shaping on the common scalar schema — prisma-next's top-level aggregate compilation drops take, negative take, skip, and cursor state, so those minima include all rows
PASS `test/integration/test/ports/engines/queries/aggregation/min/min.test.ts` › `decimal min_no_records` — empty decimal input returns a null minimum
PASS `test/integration/test/ports/engines/queries/aggregation/min/min.test.ts` › `decimal min_some_records` — decimal minimum matches the source value using prisma-next's Numeric string representation
FAIL `test/integration/test/ports/engines/queries/aggregation/min/min.test.ts` › `decimal min_with_all_sorts_of_query_args` — decimal minimum after take, negative take, skip, where, and cursor input shaping — prisma-next's top-level aggregate compilation drops take, negative take, skip, and cursor state, so those minima include all rows
