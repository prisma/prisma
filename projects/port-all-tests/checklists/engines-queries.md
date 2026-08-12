# Checklist — prisma-engines query-engine tests (queries/)

Source: prisma/prisma-engines@e922089b7d7502aff4249d5da3420f6fa55fc6ad — query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/

Protocol: each line is one source test. `[ ]` = not yet dispositioned. The Opus reviewer sub-agent checks `[x]` ONLY when satisfied that the test is (a) faithfully ported and passing, (b) faithfully ported as `test.fails` with a `failing.md` entry, or (c) covered by a justified individual `non-ported.md` entry. Implementer sub-agents never check boxes.

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/aggregation/avg.rs
- [ ] `queries::aggregation::avg::avg_no_records` — returns null avg for int/bInt/float when no records [connectors: all]
- [ ] `queries::aggregation::avg::avg_some_records` — computes avg over int/bInt/float across two rows [connectors: all]
- [ ] `queries::aggregation::avg::avg_with_all_sorts_of_query_args` — avg with take/skip/where/cursor query args [connectors: exclude:mongo]
- [ ] `queries::aggregation::avg::avg_no_records` — returns null decimal avg when no records [connectors: caps:decimaltype]
- [ ] `queries::aggregation::avg::avg_some_records` — computes decimal avg across two rows [connectors: caps:decimaltype]
- [ ] `queries::aggregation::avg::avg_with_all_sorts_of_query_args` — decimal avg with take/skip/where/cursor args [connectors: exclude:mongo caps:decimaltype]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/aggregation/combination_spec.rs
- [ ] `queries::aggregation::combination_spec::no_records` — count/sum/avg/min/max all null/zero with no records [connectors: all]
- [ ] `queries::aggregation::combination_spec::some_records` — combined count/sum/avg/min/max over two rows [connectors: all]
- [ ] `queries::aggregation::combination_spec::with_query_args` — combined aggregations with take/skip/where/cursor args [connectors: exclude:mongo]
- [ ] `queries::aggregation::combination_spec::unstable_cursor` — errors 2019 on cursor+orderBy aggregation combination [connectors: all]
- [ ] `queries::aggregation::combination_spec::no_records` — decimal combined aggregations null/zero with no records [connectors: caps:decimaltype]
- [ ] `queries::aggregation::combination_spec::some_records` — decimal combined aggregations over two rows [connectors: caps:decimaltype]
- [ ] `queries::aggregation::combination_spec::with_query_args` — decimal combined aggregations with query args [connectors: exclude:mongo caps:decimaltype]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/aggregation/count.rs
- [ ] `queries::aggregation::count::count_no_records` — _count _all returns 0 with no records [connectors: all]
- [ ] `queries::aggregation::count::count_nullable_fields` — _count of nullable string/int fields ignores nulls [connectors: all]
- [ ] `queries::aggregation::count::count_with_all_sorts_of_query_args` — _count with take/skip/where/orderBy/cursor args [connectors: all]
- [ ] `queries::aggregation::count::count_empty_result` — _count field ordering preserved with zero counts [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/aggregation/group_by.rs
- [ ] `queries::aggregation::group_by::group_by_no_records` — groupBy returns empty array with no records [connectors: all]
- [ ] `queries::aggregation::group_by::group_by_some_records` — groupBy string with count/sum [connectors: all]
- [ ] `queries::aggregation::group_by::group_by_rev_ordering` — groupBy string ordered desc [connectors: all]
- [ ] `queries::aggregation::group_by::group_by_multiple_ordering` — groupBy on two fields with multi-field orderBy [connectors: all]
- [ ] `queries::aggregation::group_by::group_by_take_skip` — groupBy with take/skip pagination [connectors: all]
- [ ] `queries::aggregation::group_by::group_by_scalar_filters` — scalar where filters applied before grouping [connectors: all]
- [ ] `queries::aggregation::group_by::group_by_relation_filters` — relation where filters applied before grouping [connectors: all]
- [ ] `queries::aggregation::group_by::group_by_ordering_count_aggregation` — orderBy _count aggregation asc/desc [connectors: all]
- [ ] `queries::aggregation::group_by::group_by_ordering_sum_aggregation` — orderBy _sum aggregation asc/desc [connectors: all]
- [ ] `queries::aggregation::group_by::group_by_ordering_avg_aggregation` — orderBy _avg aggregation asc/desc [connectors: all]
- [ ] `queries::aggregation::group_by::group_by_ordering_min_aggregation` — orderBy _min aggregation asc/desc [connectors: all]
- [ ] `queries::aggregation::group_by::group_by_ordering_max_aggregation` — orderBy _max aggregation asc/desc [connectors: all]
- [ ] `queries::aggregation::group_by::group_by_ordering_aggr_multiple_fields` — orderBy multiple aggregation fields [connectors: all]
- [ ] `queries::aggregation::group_by::group_by_ordering_aggr_and_having` — orderBy aggregation combined with having filter [connectors: all]
- [ ] `queries::aggregation::group_by::group_by_ordering_aggr_without_selecting` — orderBy aggregation without selecting aggregated field [connectors: all]
- [ ] `queries::aggregation::group_by::regression_21789` — enum _max/_min in aggregate and groupBy [connectors: only:postgres,cockroachdb]
- [ ] `queries::aggregation::group_by::regression_28084` — groupBy with nested relation where filter [connectors: all]
- [ ] `queries::aggregation::group_by::group_by_without_by_selection` — errors 2019 when by argument empty [connectors: all]
- [ ] `queries::aggregation::group_by::group_by_mismatch_by_args_query_sel` — errors 2019 on scalar field not in by-args [connectors: all]
- [ ] `queries::aggregation::group_by::group_by_by_args_order_by` — errors 2019 on orderBy field not in by-args [connectors: all]
- [ ] `queries::aggregation::group_by::group_by_empty_aggregation_selection` — errors 2009 on empty _sum selection [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/aggregation/group_by_having.rs
- [ ] `queries::aggregation::group_by_having::basic_having_scalar_filter` — having with scalar in/equals filters [connectors: all]
- [ ] `queries::aggregation::group_by_having::having_count_scalar_filter` — having _count equals/not/in filters [connectors: all]
- [ ] `queries::aggregation::group_by_having::having_sum_scalar_filter` — having _sum equals/not/in filters [connectors: all]
- [ ] `queries::aggregation::group_by_having::having_min_scalar_filter` — having _min equals/not/in filters [connectors: all]
- [ ] `queries::aggregation::group_by_having::having_max_scalar_filter` — having _max equals/not/in filters [connectors: all]
- [ ] `queries::aggregation::group_by_having::having_count_non_numerical_field` — having _count gt on string field [connectors: all]
- [ ] `queries::aggregation::group_by_having::having_without_aggr_sel` — having aggregation filter without selecting aggregate [connectors: all]
- [ ] `queries::aggregation::group_by_having::having_filter_mismatch_selection` — errors 2019 on having field not in selection [connectors: all]
- [ ] `queries::aggregation::group_by_having::having_avg_scalar_filter` — having decimal _avg equals filter [connectors: caps:decimaltype]
- [ ] `queries::aggregation::group_by_having::having_sum_scalar_filter` — having decimal _sum equals/not/in filters [connectors: caps:decimaltype]
- [ ] `queries::aggregation::group_by_having::having_min_scalar_filter` — having decimal _min equals/not/in filters [connectors: caps:decimaltype]
- [ ] `queries::aggregation::group_by_having::having_max_scalar_filter` — having decimal _max equals/not/in filters [connectors: caps:decimaltype]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/aggregation/many_count_relation.rs
- [ ] `queries::aggregation::many_count_relation::no_rel_records` — _count returns 0 for empty relations [connectors: all]
- [ ] `queries::aggregation::many_count_relation::count_one2m_m2m` — _count of one2m and m2m relations [connectors: all]
- [ ] `queries::aggregation::many_count_relation::count_with_cursor` — nested cursor does not affect _count [connectors: all]
- [ ] `queries::aggregation::many_count_relation::count_with_take` — nested take does not affect _count [connectors: all]
- [ ] `queries::aggregation::many_count_relation::count_with_skip` — nested skip does not affect _count [connectors: all]
- [ ] `queries::aggregation::many_count_relation::count_with_filters` — nested where filter does not affect _count [connectors: all]
- [ ] `queries::aggregation::many_count_relation::count_with_distinct` — nested distinct does not affect _count [connectors: all]
- [ ] `queries::aggregation::many_count_relation::nested_count_one2m_m2m` — nested _count across posts/comments/tags [connectors: all]
- [ ] `queries::aggregation::many_count_relation::nested_count_same_field_on_many_levels` — _count of same field at multiple relation levels [connectors: all]
- [ ] `queries::aggregation::many_count_relation::count_m_n_self_rel` — _count on m-n self relation followers/following [connectors: all]
- [ ] `queries::aggregation::many_count_relation::works_with_inmemory_args_processing` — _count correct with in-memory cursor/skip/take processing [connectors: all]
- [ ] `queries::aggregation::many_count_relation::count_one2m_compound_ids` — _count on relation with compound ids [connectors: exclude:cockroachdb caps:compoundids]
- [ ] `queries::aggregation::many_count_relation::count_one2m_compound_ids_cockroachdb` — _count on compound ids (BigInt cockroachdb variant) [connectors: only:cockroachdb]
- [ ] `queries::aggregation::many_count_relation::count_one2m_dup_child_id` — _count correct with duplicated child rows [connectors: all]
- [ ] `queries::aggregation::many_count_relation::filtered_count_one2m_m2m` — filtered _count with scalar/relation filters and cursor [connectors: all]
- [ ] `queries::aggregation::many_count_relation::filtered_count_composite` — filtered _count with composite type filter [connectors: caps:compositetypes]
- [ ] `queries::aggregation::many_count_relation::regression_nullable_count_libsql` — nullable _count coalesced to 0 [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/aggregation/max.rs
- [ ] `queries::aggregation::max::max_no_records` — returns null _max for string/int/bInt/float with no records [connectors: all]
- [ ] `queries::aggregation::max::max_some_records` — computes _max over two rows [connectors: all]
- [ ] `queries::aggregation::max::max_with_all_sorts_of_query_args` — _max with take/skip/where/cursor args [connectors: all]
- [ ] `queries::aggregation::max::max_no_records` — returns null decimal _max with no records [connectors: caps:decimaltype]
- [ ] `queries::aggregation::max::max_some_records` — computes decimal _max over two rows [connectors: caps:decimaltype]
- [ ] `queries::aggregation::max::max_with_all_sorts_of_query_args` — decimal _max with take/skip/where/cursor args [connectors: caps:decimaltype]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/aggregation/min.rs
- [ ] `queries::aggregation::min::min_no_records` — returns null _min for string/int/bInt/float with no records [connectors: all]
- [ ] `queries::aggregation::min::min_some_records` — computes _min over two rows [connectors: all]
- [ ] `queries::aggregation::min::min_with_all_sorts_of_query_args` — _min with take/skip/where/cursor args [connectors: all]
- [ ] `queries::aggregation::min::min_no_records` — returns null decimal _min with no records [connectors: caps:decimaltype]
- [ ] `queries::aggregation::min::min_some_records` — computes decimal _min over two rows [connectors: caps:decimaltype]
- [ ] `queries::aggregation::min::min_with_all_sorts_of_query_args` — decimal _min with take/skip/where/cursor args [connectors: caps:decimaltype]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/aggregation/sum.rs
- [ ] `queries::aggregation::sum::sum_no_records` — returns null _sum for int/bInt/float with no records [connectors: all]
- [ ] `queries::aggregation::sum::sum_some_records` — computes _sum over two rows [connectors: all]
- [ ] `queries::aggregation::sum::sum_with_all_sorts_of_query_args` — _sum with take/skip/where/cursor args [connectors: all]
- [ ] `queries::aggregation::sum::sum_no_records` — returns null decimal _sum with no records [connectors: caps:decimaltype]
- [ ] `queries::aggregation::sum::sum_some_records` — computes decimal _sum over two rows [connectors: caps:decimaltype]
- [ ] `queries::aggregation::sum::sum_with_all_sorts_of_query_args` — decimal _sum with take/skip/where/cursor args [connectors: caps:decimaltype]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/aggregation/uniq_count_relation.rs
- [ ] `queries::aggregation::uniq_count_relation::no_rel_records` — findUnique _count returns 0 for empty relations [connectors: all]
- [ ] `queries::aggregation::uniq_count_relation::count_one2m_m2m` — findUnique _count of one2m and m2m relations [connectors: all]
- [ ] `queries::aggregation::uniq_count_relation::count_with_cursor` — nested cursor does not affect findUnique _count [connectors: all]
- [ ] `queries::aggregation::uniq_count_relation::count_with_take` — nested take does not affect findUnique _count [connectors: all]
- [ ] `queries::aggregation::uniq_count_relation::count_with_skip` — nested skip does not affect findUnique _count [connectors: all]
- [ ] `queries::aggregation::uniq_count_relation::count_with_filters` — nested where does not affect findUnique _count [connectors: all]
- [ ] `queries::aggregation::uniq_count_relation::count_with_distinct` — nested distinct does not affect findUnique _count [connectors: all]
- [ ] `queries::aggregation::uniq_count_relation::nested_count_one2m_m2m` — nested findUnique _count across posts/comments/tags [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/batching/select_different_key_types.rs
- [ ] `queries::batching::select_different_key_types::batch_of_two_distinct` — batched vs non-batched findUnique on two distinct Float ids stay consistent [connectors: all]
- [ ] `queries::batching::select_different_key_types::batch_of_two_repeated` — batched vs non-batched findUnique on a repeated Float id stay consistent [connectors: all]
- [ ] `queries::batching::select_different_key_types::batch_of_two_distinct` — batched vs non-batched findUnique on two distinct BigInt ids stay consistent [connectors: all]
- [ ] `queries::batching::select_different_key_types::batch_of_two_repeated` — batched vs non-batched findUnique on a repeated BigInt id stay consistent [connectors: all]
- [ ] `queries::batching::select_different_key_types::batch_of_two_distinct` — batched vs non-batched findUnique on two distinct Decimal ids stay consistent [connectors: exclude:mongo]
- [ ] `queries::batching::select_different_key_types::batch_of_two_repeated` — batched vs non-batched findUnique on a repeated Decimal id stay consistent [connectors: exclude:mongo]
- [ ] `queries::batching::select_different_key_types::batch_of_two_distinct` — batched vs non-batched findUnique on two distinct DateTime ids stay consistent [connectors: all]
- [ ] `queries::batching::select_different_key_types::batch_of_two_repeated` — batched vs non-batched findUnique on a repeated DateTime id stay consistent [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/batching/select_one_compound.rs
- [ ] `queries::batching::select_one_compound::one_success` — single compound-unique findUniqueArtist returns the record [connectors: caps:anyid]
- [ ] `queries::batching::select_one_compound::two_success_one_fail` — three compound findUnique with one missing returns null for that one [connectors: caps:anyid]
- [ ] `queries::batching::select_one_compound::two_success_sel_set_reorder` — compound findUnique batch with reordered selection sets [connectors: caps:anyid]
- [ ] `queries::batching::select_one_compound::two_success_one_fail_diff_set` — two success one fail compound findUnique with different selection set [connectors: caps:anyid]
- [ ] `queries::batching::select_one_compound::one_failure` — single compound findUnique with no match returns null [connectors: caps:anyid]
- [ ] `queries::batching::select_one_compound::one_failure_one_success` — one match one null across compound findUnique batch [connectors: caps:anyid]
- [ ] `queries::batching::select_one_compound::no_compact_but_works_as_batch` — gte non-unique filter not compacted but still batched [connectors: caps:anyid]
- [ ] `queries::batching::select_one_compound::two_equal_queries` — two equal compound findUnique return the same record [connectors: caps:anyid]
- [ ] `queries::batching::select_one_compound::should_only_batch_if_possible` — asserts which compound findUnique batches compact vs not [connectors: caps:anyid]
- [ ] `queries::batching::select_one_compound::should_only_batch_if_possible_list` — scalar-list int equality findUnique batch compacts [connectors: caps:anyid,scalarlists]
- [ ] `queries::batching::select_one_compound::should_only_batch_if_possible_list_boolean` — scalar-list boolean equality findUnique batch compacts [connectors: caps:anyid,scalarlists]
- [ ] `queries::batching::select_one_compound::batch_23343` — compound unique with redundant tenantId filter batches correctly [connectors: caps:anyid]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/batching/select_one_singular.rs
- [ ] `queries::batching::select_one_singular::one_success` — single findUniqueArtist by ArtistId returns the record [connectors: all]
- [ ] `queries::batching::select_one_singular::two_success_one_fail` — three singular findUnique with one missing returns null [connectors: all]
- [ ] `queries::batching::select_one_singular::two_success_one_fail_diff_set` — two success one fail singular findUnique with different selection set [connectors: all]
- [ ] `queries::batching::select_one_singular::relation_traversal` — batched findUnique traversing the Albums relation [connectors: all]
- [ ] `queries::batching::select_one_singular::relation_traversal_filtered` — batched findUnique with filtered Albums relation [connectors: all]
- [ ] `queries::batching::select_one_singular::relation_traversal_filtered_diff` — batched findUnique with differing Album filters [connectors: all]
- [ ] `queries::batching::select_one_singular::one_failure` — single findUnique with no match returns null [connectors: all]
- [ ] `queries::batching::select_one_singular::one_failure_one_success` — one match one null across singular findUnique batch [connectors: all]
- [ ] `queries::batching::select_one_singular::two_equal_queries` — two equal singular findUnique return the same record [connectors: all]
- [ ] `queries::batching::select_one_singular::batch_bigint_id` — batch findUnique on BigInt id across graphql and json protocols [connectors: all]
- [ ] `queries::batching::select_one_singular::batch_enum` — batch findUnique on enum id compacts [connectors: caps:enums]
- [ ] `queries::batching::select_one_singular::batch_boolean` — batch findUnique on boolean unique compacts [connectors: all]
- [ ] `queries::batching::select_one_singular::repro_16548` — findUniqueOrThrow batch compaction mix regression [connectors: all]
- [ ] `queries::batching::select_one_singular::repro_13534` — citext case-insensitive unique batch is not compacted [connectors: only:postgres]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/batching/transactional_batch.rs
- [ ] `queries::batching::transactional_batch::two_success` — transactional batch of two creates succeeds [connectors: exclude:mssql]
- [ ] `queries::batching::transactional_batch::two_query_for_batch` — transactional batch queries run after a create [connectors: all]
- [ ] `queries::batching::transactional_batch::one_success_one_fail` — transactional batch rolls back on unique violation (2002) [connectors: exclude:sqlite]
- [ ] `queries::batching::transactional_batch::batch_request_idx` — failing batch reports batch_request_idx of 1 [connectors: all]
- [ ] `queries::batching::transactional_batch::one_query` — single nested create fails and rolls back [connectors: exclude:sqlite]
- [ ] `queries::batching::transactional_batch::valid_isolation_level` — Serializable isolation level accepted [connectors: exclude:mongo]
- [ ] `queries::batching::transactional_batch::invalid_isolation_level` — invalid isolation level errors 2023 [connectors: exclude:mongo]
- [ ] `queries::batching::transactional_batch::isolation_level_mongo` — mongo rejects setting isolation level 2026 [connectors: only:mongo]
- [ ] `queries::batching::transactional_batch::raw_mix` — mix of mutation and raw queries in a transactional batch [connectors: only:postgres]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/chunking.rs
- [ ] `queries::chunking::issue_23743` — findManyUser with posts across 200 users chunks IN without D1 variable error [connectors: all]
- [ ] `queries::chunking::issue_23919` — connect 400 posts to a user without expression-tree overflow [connectors: exclude:sqlite]
- [ ] `queries::chunking::in_more_items` — chunked IN query with more items than chunk size [connectors: all]
- [ ] `queries::chunking::asc_in_ordering` — ascending ordering of chunked IN query [connectors: all]
- [ ] `queries::chunking::desc_in_ordering` — descending ordering of chunked IN query [connectors: all]
- [ ] `queries::chunking::order_by_aggregation_should_fail` — chunked IN with orderBy aggregation errors 2029 [connectors: exclude:mongo,sqlite]
- [ ] `queries::chunking::order_by_relevance_should_fail` — chunked IN with orderBy relevance errors 2029 [connectors: exclude:mongo caps:nativefulltextsearchwithoutindex]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/chunking_qc.rs
- [ ] `queries::chunking_qc::create_lots_of_m2m_relations` — create m2m relations exceeding bind-value limit to exercise query-compiler chunking [connectors: exclude:mongo,vitess,mysql]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/data_types/bigint.rs
- [ ] `queries::data_types::bigint::read_one` — reads one nullable BigInt scalar back [connectors: all]
- [ ] `queries::data_types::bigint::read_many` — reads many rows' BigInt values including null [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/data_types/bool.rs
- [ ] `queries::data_types::bool::read_one` — reads one nullable Boolean scalar back [connectors: all]
- [ ] `queries::data_types::bool::read_many` — reads many rows' Boolean values including null [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/data_types/bytes.rs
- [ ] `queries::data_types::bytes::common_types` — reads Bytes on children through parent relation (issue 687) [connectors: all]
- [ ] `queries::data_types::bytes::read_one` — reads one nullable Bytes scalar back [connectors: all]
- [ ] `queries::data_types::bytes::read_many` — reads many rows' Bytes values including null [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/data_types/datetime.rs
- [ ] `queries::data_types::datetime::read_one` — reads one nullable DateTime scalar back [connectors: all]
- [ ] `queries::data_types::datetime::read_many` — reads many rows' DateTime values including null [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/data_types/decimal.rs
- [ ] `queries::data_types::decimal::read_one` — reads one nullable Decimal scalar back [connectors: caps:decimaltype]
- [ ] `queries::data_types::decimal::read_many` — reads many rows' Decimal values including null [connectors: caps:decimaltype]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/data_types/enum_type.rs
- [ ] `queries::data_types::enum_type::read_one` — reads one nullable enum scalar back [connectors: caps:enums]
- [ ] `queries::data_types::enum_type::read_many` — reads many rows' enum values including null [connectors: caps:enums]
- [ ] `queries::data_types::enum_type::read_one_invalid_sqlite` — invalid enum value inserted via raw fails with error 2023 [connectors: only:sqlite caps:enums]
- [ ] `queries::data_types::enum_type::read_one_invalid_mongo` — invalid enum value inserted via raw command fails with error 2023 [connectors: only:mongo caps:enums]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/data_types/float.rs
- [ ] `queries::data_types::float::read_one` — reads one nullable Float scalar back [connectors: all]
- [ ] `queries::data_types::float::read_many` — reads many rows' Float values including null [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/data_types/int.rs
- [ ] `queries::data_types::int::read_one` — reads one nullable Int scalar back [connectors: all]
- [ ] `queries::data_types::int::read_many` — reads many rows' Int values including null [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/data_types/json.rs
- [ ] `queries::data_types::json::read_one` — reads one Json scalar back as empty object [connectors: exclude:mysql caps:json]
- [ ] `queries::data_types::json::read_many` — reads many rows' varied Json values [connectors: exclude:mysql caps:json]
- [ ] `queries::data_types::json::read_plain_float` — reads a plain float Json value [connectors: exclude:mysql caps:json]
- [ ] `queries::data_types::json::read_plain_int` — reads a plain int Json value [connectors: exclude:mysql caps:json]
- [ ] `queries::data_types::json::read_plain_bool` — reads a plain bool Json value [connectors: exclude:mysql caps:json]
- [ ] `queries::data_types::json::json_null` — distinguishes DbNull from JsonNull in results [connectors: exclude:mysql caps:json,advancedjsonnullability]
- [ ] `queries::data_types::json::json_null_must_not_be_confused_with_literal_string` — literal "null" string not confused with json null [connectors: exclude:mysql caps:json,advancedjsonnullability]
- [ ] `queries::data_types::json::dollar_type_in_json_protocol` — $type payload stored verbatim as Json via json protocol [connectors: exclude:mysql caps:json]
- [ ] `queries::data_types::json::nested_dollar_type_in_json_protocol` — nested $type payload stored verbatim as Json [connectors: exclude:mysql caps:json]
- [ ] `queries::data_types::json::json_list` — reads Json[] scalar list on child through relation [connectors: exclude:mysql,cockroachdb caps:json,scalarlists]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/data_types/native/mssql.rs
- [ ] `queries::data_types::native::mssql::native_string` — VarChar native types cast to VARCHAR in where clauses (issue 17565) [connectors: only:mssql]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/data_types/native/mysql.rs
- [ ] `queries::data_types::native::mysql::dt_native` — reads MySQL native date/time/timestamp/year types [connectors: only:mysql]
- [ ] `queries::data_types::native::mysql::native_decimal_types` — reads MySQL native Float/Double/Decimal types [connectors: only:mysql]
- [ ] `queries::data_types::native::mysql::native_string` — reads MySQL native Char/VarChar/Text types [connectors: only:mysql]
- [ ] `queries::data_types::native::mysql::native_bytes` — reads MySQL native Bit/Binary/Blob types [connectors: only:mysql]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/data_types/native/postgres.rs
- [ ] `queries::data_types::native::postgres::dt_native` — reads Postgres native date/time/timetz/timestamptz types [connectors: only:postgres,cockroachdb]
- [ ] `queries::data_types::native::postgres::native_decimal_types` — reads Postgres native Real/Double/Decimal/Money types [connectors: only:postgres]
- [ ] `queries::data_types::native::postgres::native_money_type` — reads Postgres native Money scalar and list [connectors: only:postgres]
- [ ] `queries::data_types::native::postgres::native_string` — reads Postgres native Char/VarChar/Bit/Uuid/Inet types [connectors: only:postgres]
- [ ] `queries::data_types::native::postgres::native_other_types` — reads Postgres native Boolean/ByteA/Json/JsonB types [connectors: only:postgres]
- [ ] `queries::data_types::native::postgres::native_xml` — reads Postgres native Xml type [connectors: only:postgres]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/data_types/string.rs
- [ ] `queries::data_types::string::read_one` — reads one nullable String scalar back [connectors: all]
- [ ] `queries::data_types::string::read_many` — reads many rows' String values including null [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/data_types/through_relation.rs
- [ ] `queries::data_types::through_relation::common_types` — reads common scalar types on children through parent relation [connectors: all]
- [ ] `queries::data_types::through_relation::json_type` — reads Json values on children through parent relation [connectors: exclude:mysql caps:json]
- [ ] `queries::data_types::through_relation::enum_type` — reads enum values on children through parent relation [connectors: caps:enums]
- [ ] `queries::data_types::through_relation::decimal_type` — reads Decimal values on children through parent relation [connectors: exclude:sqlite caps:decimaltype]
- [ ] `queries::data_types::through_relation::scalar_lists` — reads scalar-list fields on children through parent relation [connectors: exclude:postgres,cockroachdb caps:scalarlists]
- [ ] `queries::data_types::through_relation::oid_type` — reads Oid-typed Int values on children through parent relation [connectors: only:postgres,cockroachdb]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/distinct.rs
- [ ] `queries::distinct::empty_database` — distinct returns empty on empty database [connectors: all]
- [ ] `queries::distinct::no_panic` — distinct without selecting the distinct fields doesn't panic [connectors: all]
- [ ] `queries::distinct::shorthand_works` — shorthand distinct on a single field [connectors: all]
- [ ] `queries::distinct::with_duplicates` — distinct dedupes duplicate rows [connectors: all]
- [ ] `queries::distinct::with_skip_basic` — distinct combined with skip [connectors: all]
- [ ] `queries::distinct::with_skip_orderby` — distinct combined with skip and orderBy [connectors: all]
- [ ] `queries::distinct::with_skip_orderby_nondistinct` — distinct with orderBy on a non-distinct field [connectors: all]
- [ ] `queries::distinct::nested_distinct` — nested distinct on user and posts [connectors: all]
- [ ] `queries::distinct::nested_distinct_order_by_field` — nested distinct ordered by field [connectors: all]
- [ ] `queries::distinct::nested_distinct_reversed` — nested distinct with both orderings reversed [connectors: all]
- [ ] `queries::distinct::nested_distinct_not_in_selection` — nested distinct with distinct field not in selection [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/bigint_filter.rs
- [ ] `queries::filters::bigint_filter::basic_where` — filter bInt with equals, not, and not null [connectors: all]
- [ ] `queries::filters::bigint_filter::where_shorthands` — bInt shorthand equality and null (mongo excludes undefined) [connectors: all]
- [ ] `queries::filters::bigint_filter::inclusion_filter` — filter bInt with in, notIn, and not in [connectors: all]
- [ ] `queries::filters::bigint_filter::numeric_comparison_filters` — filter bInt with gt/gte/lt/lte and their negations [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/bytes_filter.rs
- [ ] `queries::filters::bytes_filter::basic_where` — filter bytes with equals, not, and not null [connectors: exclude:vitess]
- [ ] `queries::filters::bytes_filter::where_shorthands` — bytes shorthand equality and null (mongo excludes undefined) [connectors: exclude:vitess]
- [ ] `queries::filters::bytes_filter::inclusion_filter` — filter bytes/bInt with in, notIn, and not in [connectors: exclude:vitess]
- [ ] `queries::filters::bytes_filter::numeric_comparison_filters` — filter bInt with gt/gte/lt/lte and their negations [connectors: exclude:vitess]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/composite/combination/composite.rs
- [ ] `queries::filters::composite::combination::composite::com_to_one_2_to_many` — filters over to-one composite into to-many composite with every gt condition [connectors: only:mongo]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/composite/combination/to_many_relation.rs
- [ ] `queries::filters::composite::combination::to_many_relation::to_to_one_com_basic_every` — to-many relation every into to-one composite is/isNot with insensitive equals and null [connectors: only:mongo]
- [ ] `queries::filters::composite::combination::to_many_relation::to_to_one_com_basic_some` — to-many relation some into to-one composite is/isNot equals [connectors: only:mongo]
- [ ] `queries::filters::composite::combination::to_many_relation::to_to_one_com_basic_none` — to-many relation none into to-one composite is/isNot equals [connectors: only:mongo]
- [ ] `queries::filters::composite::combination::to_many_relation::to_to_one_com_scalar_list` — to-many relation every into to-one composite scalar_list has [connectors: only:mongo]
- [ ] `queries::filters::composite::combination::to_many_relation::to_to_one_com_to_to_one_com_to_to_one_com` — to-many relation every into nested to-one composite contains [connectors: only:mongo]
- [ ] `queries::filters::composite::combination::to_many_relation::to_to_one_com_to_to_many_com` — to-many relation every into to-one composite into to-many composite every contains [connectors: only:mongo]
- [ ] `queries::filters::composite::combination::to_many_relation::to_to_many_com` — to-many relation every into to-many composite every/none/some contains [connectors: only:mongo]
- [ ] `queries::filters::composite::combination::to_many_relation::to_to_many_com_to_to_one_com` — to-many relation into to-many composite some into to-one composite insensitive equals [connectors: only:mongo]
- [ ] `queries::filters::composite::combination::to_many_relation::to_to_many_com_to_to_many_com` — to-many relation into to-many composite some into to-many composite every contains [connectors: only:mongo]
- [ ] `queries::filters::composite::combination::to_many_relation::to_to_many_com_to_to_many_com_to_scalar_list` — to-many relation into to-many composite every scalar_list has [connectors: only:mongo]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/composite/combination/to_one_relation.rs
- [ ] `queries::filters::composite::combination::to_one_relation::to_to_one_com_basic` — to-one relation is/isNot into to-one composite is/isNot contains and null checks [connectors: only:mongo]
- [ ] `queries::filters::composite::combination::to_one_relation::to_to_one_com_multiple` — to-one relation into to-one composite multiple conditions AND/OR/NOT [connectors: only:mongo]
- [ ] `queries::filters::composite::combination::to_one_relation::to_to_one_com_logical_cond` — to-one relation into to-one composite logical AND/OR/NOT conditions [connectors: only:mongo]
- [ ] `queries::filters::composite::combination::to_one_relation::to_to_one_scalar_list` — to-one relation into to-one composite scalar_list isEmpty [connectors: only:mongo]
- [ ] `queries::filters::composite::combination::to_one_relation::to_to_one_com_to_to_one_com` — to-one relation into to-one composite into nested to-one composite is/isNot contains [connectors: only:mongo]
- [ ] `queries::filters::composite::combination::to_one_relation::to_to_one_com_to_to_many_com` — to-one relation into to-one composite into to-many composite some insensitive contains [connectors: only:mongo]
- [ ] `queries::filters::composite::combination::to_one_relation::to_to_many_com_basic` — to-one relation into to-many composite equals/every/none/some conditions [connectors: only:mongo]
- [ ] `queries::filters::composite::combination::to_one_relation::scalar_lists_to_one_to_many` — to-one relation into to-many composite every/none/some scalar_list has [connectors: only:mongo]
- [ ] `queries::filters::composite::combination::to_one_relation::to_to_many_com_to_to_one_com` — to-one relation into to-many composite every into to-one composite insensitive contains [connectors: only:mongo]
- [ ] `queries::filters::composite::combination::to_one_relation::to_to_many_com_to_to_many_com` — to-one relation into to-many composite every into nested to-many composite every contains [connectors: only:mongo]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/composite/equals.rs
- [ ] `queries::filters::composite::equals::basic_equality` — to-many composite list equals and implicit equal with NOT [connectors: only:mongo]
- [ ] `queries::filters::composite::equals::field_order_matters` — to-many composite equals is order-sensitive on object fields [connectors: only:mongo]
- [ ] `queries::filters::composite::equals::object_order_matters` — to-many composite equals is order-sensitive on list elements [connectors: only:mongo]
- [ ] `queries::filters::composite::equals::empty_comparison` — to-many composite equals empty list and implicit with NOT [connectors: only:mongo]
- [ ] `queries::filters::composite::equals::single_object` — to-many composite equals with single object errors 2009 [connectors: only:mongo]
- [ ] `queries::filters::composite::equals::basic` — to-one composite equals full nested object with NOT [connectors: only:mongo]
- [ ] `queries::filters::composite::equals::field_order_matters` — to-one composite equals is order-sensitive on fields [connectors: only:mongo]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/composite/every.rs
- [ ] `queries::filters::composite::every::basic` — to-many composite every gt condition [connectors: only:mongo]
- [ ] `queries::filters::composite::every::empty` — to-many composite every empty filter matches all, with NOT [connectors: only:mongo]
- [ ] `queries::filters::composite::every::empty_logical_conditions` — to-many composite every empty AND/OR/NOT logical conditions [connectors: only:mongo]
- [ ] `queries::filters::composite::every::locical_and` — to-many composite every implicit and explicit AND [connectors: only:mongo]
- [ ] `queries::filters::composite::every::insensitive` — to-many composite every insensitive contains [connectors: only:mongo caps:insensitivefilters]
- [ ] `queries::filters::composite::every::logical_or` — to-many composite every explicit OR contains [connectors: only:mongo]
- [ ] `queries::filters::composite::every::logical_not` — to-many composite every explicit NOT contains [connectors: only:mongo]
- [ ] `queries::filters::composite::every::nested_every` — to-many composite every into nested to-many composite every gte [connectors: only:mongo]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/composite/is.rs
- [ ] `queries::filters::composite::is::basic` — to-one composite is/isNot lt condition [connectors: only:mongo]
- [ ] `queries::filters::composite::is::empty` — to-one composite is/isNot empty filter matches all [connectors: only:mongo]
- [ ] `queries::filters::composite::is::multiple_and` — to-one composite is implicit and explicit AND [connectors: only:mongo]
- [ ] `queries::filters::composite::is::multiple_or` — to-one composite is explicit OR [connectors: only:mongo]
- [ ] `queries::filters::composite::is::not_combinations` — to-one composite NOT/isNot combinations with AND and OR [connectors: only:mongo]
- [ ] `queries::filters::composite::is::multiple_hops` — to-one composite is over multiple nested hops with OR and NOT [connectors: only:mongo]
- [ ] `queries::filters::composite::is::insensitive_must_work` — to-one composite is insensitive contains [connectors: only:mongo]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/composite/is_empty.rs
- [ ] `queries::filters::composite::is_empty::basic_empty_check` — to-many composite isEmpty true/false [connectors: only:mongo]
- [ ] `queries::filters::composite::is_empty::negation` — to-many composite isEmpty negated with NOT [connectors: only:mongo]
- [ ] `queries::filters::composite::is_empty::silly_combinations` — to-many composite isEmpty AND/OR silly combinations [connectors: only:mongo]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/composite/is_set.rs
- [ ] `queries::filters::composite::is_set::basic` — to-one composite isSet true/false [connectors: only:mongo]
- [ ] `queries::filters::composite::is_set::negation` — to-one composite isSet negated with NOT [connectors: only:mongo]
- [ ] `queries::filters::composite::is_set::with_null_check` — to-one composite isSet combined with is/isNot null [connectors: only:mongo]
- [ ] `queries::filters::composite::is_set::negation_with_null_check` — to-one composite isSet negated combined with is/isNot null [connectors: only:mongo]
- [ ] `queries::filters::composite::is_set::with_equality_check` — to-one composite isSet combined with is/isNot equality [connectors: only:mongo]
- [ ] `queries::filters::composite::is_set::silly_logical_combinations` — to-one composite isSet OR/AND/NOT silly combinations [connectors: only:mongo]
- [ ] `queries::filters::composite::is_set::fails_on_required` — isSet on required to-one composite errors 2009 [connectors: only:mongo]
- [ ] `queries::filters::composite::is_set::basic` — scalar field isSet true/false [connectors: only:mongo]
- [ ] `queries::filters::composite::is_set::negation` — scalar field isSet negated with NOT [connectors: only:mongo]
- [ ] `queries::filters::composite::is_set::with_null_check` — scalar field isSet combined with not/equals null [connectors: only:mongo]
- [ ] `queries::filters::composite::is_set::negation_with_null_check` — scalar field isSet negated combined with not/equals null [connectors: only:mongo]
- [ ] `queries::filters::composite::is_set::with_equality_check` — scalar field isSet combined with equals/not value [connectors: only:mongo]
- [ ] `queries::filters::composite::is_set::silly_logical_combinations` — scalar field isSet OR/AND/NOT silly combinations [connectors: only:mongo]
- [ ] `queries::filters::composite::is_set::fails_on_required` — isSet on required scalar field errors 2009 [connectors: only:mongo]
- [ ] `queries::filters::composite::is_set::basic` — to-many composite isSet true/false [connectors: only:mongo]
- [ ] `queries::filters::composite::is_set::negation` — to-many composite isSet negated with NOT [connectors: only:mongo]
- [ ] `queries::filters::composite::is_set::with_equality_check` — to-many composite isSet combined with some/none/equals [connectors: only:mongo]
- [ ] `queries::filters::composite::is_set::silly_logical_combinations` — to-many composite isSet OR/AND/NOT silly combinations [connectors: only:mongo]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/composite/none.rs
- [ ] `queries::filters::composite::none::basic` — to-many composite none lt condition [connectors: only:mongo]
- [ ] `queries::filters::composite::none::empty` — to-many composite none empty filter with NOT [connectors: only:mongo]
- [ ] `queries::filters::composite::none::empty_logical_conditions` — to-many composite none empty AND/OR/NOT logical conditions [connectors: only:mongo]
- [ ] `queries::filters::composite::none::locical_and` — to-many composite none implicit and explicit AND [connectors: only:mongo]
- [ ] `queries::filters::composite::none::insensitive` — to-many composite none insensitive contains [connectors: only:mongo caps:insensitivefilters]
- [ ] `queries::filters::composite::none::logical_or` — to-many composite none explicit OR [connectors: only:mongo]
- [ ] `queries::filters::composite::none::logical_not` — to-many composite none explicit NOT [connectors: only:mongo]
- [ ] `queries::filters::composite::none::nested_none` — to-many composite none into nested to-many composite none gt [connectors: only:mongo]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/composite/some.rs
- [ ] `queries::filters::composite::some::basic` — to-many composite some lt condition [connectors: only:mongo]
- [ ] `queries::filters::composite::some::empty` — to-many composite some empty filter with NOT [connectors: only:mongo]
- [ ] `queries::filters::composite::some::empty_logical_conditions` — to-many composite some empty AND/OR/NOT logical conditions [connectors: only:mongo]
- [ ] `queries::filters::composite::some::locical_and` — to-many composite some implicit and explicit AND [connectors: only:mongo]
- [ ] `queries::filters::composite::some::insensitive` — to-many composite some insensitive contains [connectors: only:mongo caps:insensitivefilters]
- [ ] `queries::filters::composite::some::logical_or` — to-many composite some explicit OR [connectors: only:mongo]
- [ ] `queries::filters::composite::some::logical_not` — to-many composite some explicit NOT [connectors: only:mongo]
- [ ] `queries::filters::composite::some::nested_some` — to-many composite some into nested to-many composite some lt [connectors: only:mongo]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/decimal_filter.rs
- [ ] `queries::filters::decimal_filter::basic_where` — filter decimal with equals, not, and not null [connectors: caps:decimaltype]
- [ ] `queries::filters::decimal_filter::where_shorthands` — decimal shorthand equality and null (mongo excludes undefined) [connectors: caps:decimaltype]
- [ ] `queries::filters::decimal_filter::inclusion_filter` — filter decimal with in, notIn, and not in [connectors: caps:decimaltype]
- [ ] `queries::filters::decimal_filter::numeric_comparison_filters` — filter decimal with gt/gte/lt/lte and their negations [connectors: caps:decimaltype]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/extended_relation_filters.rs
- [ ] `queries::filters::extended_relation_filters::basic_scalar_filter` — filters artists by scalar ArtistId equals [connectors: all]
- [ ] `queries::filters::extended_relation_filters::rel_filter_l1_depth1` — filters albums by to-one Artist name is [connectors: all]
- [ ] `queries::filters::extended_relation_filters::mysql_rel1_many_filters` — MySQL case-insensitive some/every/none relation title filters [connectors: only:mysql]
- [ ] `queries::filters::extended_relation_filters::pg_rel1_some_filter` — Postgres case-sensitive Albums some startsWith filter [connectors: only:postgres]
- [ ] `queries::filters::extended_relation_filters::pg_rel1_every_filter` — Postgres Albums every title contains/not-contains filter [connectors: only:postgres]
- [ ] `queries::filters::extended_relation_filters::pg_rel1_none_filter` — Postgres Albums none title contains filter [connectors: only:postgres]
- [ ] `queries::filters::extended_relation_filters::rel_filter_l2_some_some` — two-level some/some Tracks filter on artists [connectors: all]
- [ ] `queries::filters::extended_relation_filters::rel_filter_l2_all_filters` — two-level every/some/none combination Tracks filters [connectors: all]
- [ ] `queries::filters::extended_relation_filters::rel_filter_l2_implicit_and_some` — Tracks some with implicit AND of MediaType and Genre is [connectors: all]
- [ ] `queries::filters::extended_relation_filters::rel_filter_l2_implicit_and_every` — Tracks every with implicit AND of MediaType and Genre is [connectors: all]
- [ ] `queries::filters::extended_relation_filters::rel_filter_l2_explicit_and_some` — Tracks some with explicit AND list including empty [connectors: all]
- [ ] `queries::filters::extended_relation_filters::rel_filter_l2_explicit_and_every` — Tracks every with explicit AND list including empty [connectors: all]
- [ ] `queries::filters::extended_relation_filters::rel_filter_l2_explicit_or_all` — Tracks some/every with explicit OR list including empty [connectors: all]
- [ ] `queries::filters::extended_relation_filters::rel_filter_l2_explicit_not_all` — Tracks some/every with explicit NOT list including empty [connectors: all]
- [ ] `queries::filters::extended_relation_filters::rel_filter_l3` — three-level genre through track/album/artist ArtistId filter [connectors: all]
- [ ] `queries::filters::extended_relation_filters::rel_scalar_filter` — nested relation plus scalar TrackId filter on artists [connectors: all]
- [ ] `queries::filters::extended_relation_filters::empty_none` — genres with none tracks empty filter [connectors: all]
- [ ] `queries::filters::extended_relation_filters::empty_some` — genres with some tracks empty filter [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/field_reference/bigint_filter.rs
- [ ] `queries::filters::field_reference::bigint_filter::basic_where` — bigint field equals/not-equals another referenced bigint field [connectors: all]
- [ ] `queries::filters::field_reference::bigint_filter::numeric_comparison_filters` — bigint gt/gte/lt/lte (and negations) against referenced bigint field [connectors: all]
- [ ] `queries::filters::field_reference::bigint_filter::inclusion_filter` — bigint in/notIn a referenced bigint list field [connectors: caps:scalarlists]
- [ ] `queries::filters::field_reference::bigint_filter::scalar_list_filters` — bigint list has/hasSome/hasEvery against referenced fields [connectors: caps:scalarlists]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/field_reference/bytes_filter.rs
- [ ] `queries::filters::field_reference::bytes_filter::basic_where` — bytes field equals/not-equals another referenced bytes field [connectors: all]
- [ ] `queries::filters::field_reference::bytes_filter::inclusion_filter` — bytes in/notIn a referenced bytes list field [connectors: caps:scalarlists]
- [ ] `queries::filters::field_reference::bytes_filter::scalar_list_filters` — bytes list has/hasSome/hasEvery against referenced fields [connectors: caps:scalarlists]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/field_reference/composite_filter.rs
- [ ] `queries::filters::field_reference::composite_filter::composite_equality` — composite is/isNot with referenced field inside the composite [connectors: caps:compositetypes]
- [ ] `queries::filters::field_reference::composite_filter::list_equality` — composite list some/every/none with referenced field inside the composite [connectors: caps:compositetypes]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/field_reference/datetime_filter.rs
- [ ] `queries::filters::field_reference::datetime_filter::basic_where` — datetime field equals/not-equals another referenced datetime field [connectors: all]
- [ ] `queries::filters::field_reference::datetime_filter::numeric_comparison_filters` — datetime gt/gte/lt/lte (and negations) against referenced datetime field [connectors: all]
- [ ] `queries::filters::field_reference::datetime_filter::inclusion_filter` — datetime in/notIn a referenced datetime list field [connectors: caps:scalarlists]
- [ ] `queries::filters::field_reference::datetime_filter::scalar_list_filters` — datetime list has/hasSome/hasEvery against referenced fields [connectors: caps:scalarlists]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/field_reference/decimal_filter.rs
- [ ] `queries::filters::field_reference::decimal_filter::basic_where` — decimal field equals/not-equals another referenced decimal field [connectors: caps:decimaltype]
- [ ] `queries::filters::field_reference::decimal_filter::numeric_comparison_filters` — decimal gt/gte/lt/lte (and negations) against referenced decimal field [connectors: caps:decimaltype]
- [ ] `queries::filters::field_reference::decimal_filter::inclusion_filter` — decimal in/notIn a referenced decimal list field [connectors: caps:decimaltype,scalarlists]
- [ ] `queries::filters::field_reference::decimal_filter::scalar_list_filters` — decimal list has/hasSome/hasEvery against referenced fields [connectors: caps:decimaltype,scalarlists]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/field_reference/enum_filter.rs
- [ ] `queries::filters::field_reference::enum_filter::inclusion_filter` — enum in/notIn a referenced enum list field [connectors: caps:enums,scalarlists]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/field_reference/failure.rs
- [ ] `queries::filters::field_reference::failure::unknown_field_name_fails` — referencing a non-existent scalar field errors 2019 [connectors: all]
- [ ] `queries::filters::field_reference::failure::fields_of_different_models_fails` — referencing a field of a different model errors 2019 [connectors: all]
- [ ] `queries::filters::field_reference::failure::fields_of_different_container_fails` — referencing a composite-type field as a model field errors 2019 [connectors: caps:compositetypes]
- [ ] `queries::filters::field_reference::failure::relation_field_name_fails` — referencing a relation field instead of scalar errors 2019 [connectors: all]
- [ ] `queries::filters::field_reference::failure::fields_of_different_type_fails` — referencing a field of a different scalar type errors 2019 [connectors: all]
- [ ] `queries::filters::field_reference::failure::field_of_different_arity_fails` — referencing a list field for a scalar filter errors 2019 [connectors: caps:scalarlists]
- [ ] `queries::filters::field_reference::failure::field_ref_inclusion_filter_fails` — field ref in in/notIn fails on connectors without scalar lists errors 2009 [connectors: exclude:mongo,postgres,cockroachdb]
- [ ] `queries::filters::field_reference::failure::field_ref_in_having_must_be_selected` — field ref in having on an unselected field errors 2019 [connectors: all]
- [ ] `queries::filters::field_reference::failure::count_expect_int_field_ref` — _count having field ref must reference an Int field else errors 2019 [connectors: all]
- [ ] `queries::filters::field_reference::failure::json_string_expect_string_field_ref` — json string_contains/ends_with/starts_with field ref must be String errors 2019 [connectors: exclude:mysql caps:jsonfiltering]
- [ ] `queries::filters::field_reference::failure::referencing_composite_field_fails` — referencing a composite field directly errors 2009 [connectors: caps:compositetypes]
- [ ] `queries::filters::field_reference::failure::alphanumeric_json_filter_fails` — alphanumeric json field ref not allowed on MySQL/MariaDB errors 2009 [connectors: only:mysql]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/field_reference/float_filter.rs
- [ ] `queries::filters::field_reference::float_filter::basic_where` — float field equals/not-equals another referenced float field [connectors: all]
- [ ] `queries::filters::field_reference::float_filter::numeric_comparison_filters` — float gt/gte/lt/lte (and negations) against referenced float field [connectors: all]
- [ ] `queries::filters::field_reference::float_filter::inclusion_filter` — float in/notIn a referenced float list field [connectors: caps:scalarlists]
- [ ] `queries::filters::field_reference::float_filter::scalar_list_filters` — float list has/hasSome/hasEvery against referenced fields [connectors: caps:scalarlists]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/field_reference/having_filter.rs
- [ ] `queries::filters::field_reference::having_filter::basic_having_filter` — groupBy having with field ref on equals, _count and _max aggregations [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/field_reference/int_filter.rs
- [ ] `queries::filters::field_reference::int_filter::basic_where` — int field equals/not-equals another referenced int field [connectors: all]
- [ ] `queries::filters::field_reference::int_filter::numeric_comparison_filters` — int gt/gte/lt/lte (and negations) against referenced int field [connectors: all]
- [ ] `queries::filters::field_reference::int_filter::inclusion_filter` — int in/notIn a referenced int list field [connectors: caps:scalarlists]
- [ ] `queries::filters::field_reference::int_filter::scalar_list_filters` — int list has/hasSome/hasEvery against referenced fields [connectors: caps:scalarlists]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/field_reference/json_filter.rs
- [ ] `queries::filters::field_reference::json_filter::does_not_strip_nulls_in_json` — reading json preserves nulls inside the json value [connectors: exclude:mysql caps:jsonfiltering]
- [ ] `queries::filters::field_reference::json_filter::basic_where` — json field equals/not another referenced json field [connectors: exclude:mysql caps:jsonfiltering]
- [ ] `queries::filters::field_reference::json_filter::numeric_comparison_filters` — json path gt/gte/lt/lte against referenced json field [connectors: exclude:mysql caps:jsonfiltering,jsonfilteringalphanumericfieldref]
- [ ] `queries::filters::field_reference::json_filter::string_comparison_filters` — json path string_contains/starts_with/ends_with against referenced string field [connectors: exclude:mysql caps:jsonfiltering]
- [ ] `queries::filters::field_reference::json_filter::array_comparison_filters` — json path array_contains/starts_with/ends_with against referenced json field [connectors: exclude:mysql,sqlite caps:jsonfiltering]
- [ ] `queries::filters::field_reference::json_filter::scalar_list_filters` — json list has/hasSome/hasEvery against referenced fields [connectors: exclude:mysql,cockroachdb caps:jsonfiltering,scalarlists]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/field_reference/relation_filter.rs
- [ ] `queries::filters::field_reference::relation_filter::ensure_scalar_filters_can_run` — scalar field-ref filters through a to-one relation all run [connectors: all]
- [ ] `queries::filters::field_reference::relation_filter::ensure_scalar_list_filters_can_run` — scalar-list field-ref filters through a to-one relation all run [connectors: caps:scalarlists]
- [ ] `queries::filters::field_reference::relation_filter::one_to_one` — field ref equals across a one-to-one relation [connectors: all]
- [ ] `queries::filters::field_reference::relation_filter::one_to_many` — field ref equals with some/none/every over a one-to-many relation [connectors: all]
- [ ] `queries::filters::field_reference::relation_filter::many_to_many` — field ref equals with some/none/every over a many-to-many relation [connectors: all]
- [ ] `queries::filters::field_reference::relation_filter::complex_relation_traversal` — field ref equals through nested to-many then to-one relation traversal [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/field_reference/string_filter.rs
- [ ] `queries::filters::field_reference::string_filter::basic_where_sensitive` — string equals/not-equals another referenced string field, case-sensitive [connectors: all]
- [ ] `queries::filters::field_reference::string_filter::basic_where_insensitive` — string equals/not-equals referenced field in insensitive mode [connectors: caps:insensitivefilters]
- [ ] `queries::filters::field_reference::string_filter::numeric_comparison_filters_sensitive` — string gt/gte/lt/lte against referenced string field, case-sensitive [connectors: all]
- [ ] `queries::filters::field_reference::string_filter::numeric_comparison_filters_insensitive` — string gt/gte/lt/lte against referenced field in insensitive mode [connectors: exclude:mongo caps:insensitivefilters]
- [ ] `queries::filters::field_reference::string_filter::string_comparison_filters_sensitive` — string contains/startsWith/endsWith against referenced field, case-sensitive [connectors: all]
- [ ] `queries::filters::field_reference::string_filter::string_comparison_filters_insensitive` — string contains/startsWith/endsWith against referenced field, insensitive mode [connectors: caps:insensitivefilters]
- [ ] `queries::filters::field_reference::string_filter::inclusion_filter_sensitive` — string in/notIn a referenced string list field, case-sensitive [connectors: caps:scalarlists]
- [ ] `queries::filters::field_reference::string_filter::inclusion_filter_insensitive` — string in/notIn a referenced string list field, insensitive mode [connectors: caps:scalarlists,insensitivefilters]
- [ ] `queries::filters::field_reference::string_filter::scalar_list_filters_sensitive` — string list has/hasSome/hasEvery against referenced fields [connectors: caps:scalarlists]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/filter_regression.rs
- [ ] `queries::filters::filter_regression::work_with_nulls` — 1:m none/every/is relation filters with nullable fields [connectors: all]
- [ ] `queries::filters::filter_regression::work_with_nulls` — 1:m none/every relation filters with compound ids [connectors: caps:compoundids]
- [ ] `queries::filters::filter_regression::work_with_nulls` — m:n none/every relation filters with nullable fields [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/filter_unwrap.rs
- [ ] `queries::filters::filter_unwrap::many_filter` — nested deleteMany with in filter on subItems succeeds [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/filters.rs
- [ ] `queries::filters::filters::no_filter` — findMany with empty filter returns all rows for each model [connectors: all]
- [ ] `queries::filters::filters::simple` — filters users by name equals [connectors: all]
- [ ] `queries::filters::filters::inverted_simple` — filters users by name not equals [connectors: all]
- [ ] `queries::filters::filters::implicit_not_equals` — filters by shorthand not without equals wrapper [connectors: all]
- [ ] `queries::filters::filters::implicit_equals` — filters by shorthand scalar value as implicit equals [connectors: all]
- [ ] `queries::filters::filters::implicit_equals_null` — implicit equals null returns no rows [connectors: all]
- [ ] `queries::filters::filters::in_null` — in null filter, empty for MongoDB and all rows otherwise [connectors: all]
- [ ] `queries::filters::filters::in_list` — filters by name in a list of values [connectors: all]
- [ ] `queries::filters::filters::not_in_list` — filters by name notIn a list of values [connectors: all]
- [ ] `queries::filters::filters::not_in_null` — notIn null returns all rows [connectors: all]
- [ ] `queries::filters::filters::relation_null` — filters users whose relation is null [connectors: all]
- [ ] `queries::filters::filters::and` — combines conditions with AND [connectors: all]
- [ ] `queries::filters::filters::empty_and` — empty AND returns all rows [connectors: all]
- [ ] `queries::filters::filters::or` — combines conditions with OR [connectors: all]
- [ ] `queries::filters::filters::empty_or` — empty OR returns no rows [connectors: all]
- [ ] `queries::filters::filters::empty_not` — empty NOT returns all rows [connectors: all]
- [ ] `queries::filters::filters::not` — negates a condition with NOT [connectors: all]
- [ ] `queries::filters::filters::not_not` — double NOT restores original condition [connectors: all]
- [ ] `queries::filters::filters::not_list` — NOT with a list of conditions negates all [connectors: all]
- [ ] `queries::filters::filters::nested_filter` — filters via nested relation field condition [connectors: all]
- [ ] `queries::filters::filters::starts_with` — filters by name startsWith [connectors: all]
- [ ] `queries::filters::filters::contains` — filters by name contains [connectors: all]
- [ ] `queries::filters::filters::greater_than` — filters float field with gt [connectors: all]
- [ ] `queries::filters::filters::inverted_null` — not null on optional field returns all rows [connectors: all]
- [ ] `queries::filters::filters::inverted_null_required` — errors (2009) on not null against a required field [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/insensitive_filters.rs
- [ ] `queries::filters::insensitive_filters::string_matchers` — insensitive startsWith/endsWith/contains matchers [connectors: caps:insensitivefilters]
- [ ] `queries::filters::insensitive_filters::neg_string_matchers` — insensitive negated startsWith/endsWith/contains matchers [connectors: caps:insensitivefilters]
- [ ] `queries::filters::insensitive_filters::numeric_matchers` — insensitive gt/gte/lt/lte and their negations [connectors: caps:insensitivefilters]
- [ ] `queries::filters::insensitive_filters::comparator_ops` — insensitive equals/gte/lt with accented chars and collation [connectors: caps:insensitivefilters]
- [ ] `queries::filters::insensitive_filters::list_containment_ops` — insensitive in and not in list containment [connectors: caps:insensitivefilters]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/insensitive_json_filters.rs
- [ ] `queries::filters::insensitive_json_filters::string_matcher` — insensitive json path equals string matcher [connectors: caps:insensitivefilters,jsonfiltering]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/json.rs
- [ ] `queries::filters::json::basic` — json equals and not with DbNull handling [connectors: exclude:mysql caps:json]
- [ ] `queries::filters::json::basic_null_eq` — json equals DbNull/JsonNull/AnyNull null variants [connectors: exclude:mysql caps:json]
- [ ] `queries::filters::json::basic_not_null_eq` — NOT json equals for DbNull/JsonNull/AnyNull null variants [connectors: exclude:mysql caps:json]
- [ ] `queries::filters::json::req_json_null_filters` — required json field null filters and DbNull create rejection [connectors: exclude:mysql caps:json]
- [ ] `queries::filters::json::basic_null_eq_defaults` — json equals JsonNull/AnyNull with default field [connectors: exclude:mysql caps:json]
- [ ] `queries::filters::json::no_shorthands` — json shorthand equality and null are rejected [connectors: exclude:mysql caps:json]
- [ ] `queries::filters::json::nested_not_shorthand` — nested not json shorthand rejected under graphql protocol [connectors: exclude:mysql,vitess,postgres,sqlite,cockroachdb caps:json]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/json_filters.rs
- [ ] `queries::filters::json_filters::no_path_without_filter` — errors (2019) when a JSON path is set without a scalar filter [connectors: exclude:mysql caps:jsonfiltering]
- [ ] `queries::filters::json_filters::extract_array_path_pg_json` — filters by JSON array path equals on native pg Json column [connectors: exclude:mysql,cockroachdb caps:jsonfiltering,jsonfilteringarraypath]
- [ ] `queries::filters::json_filters::extract_array_path` — filters by JSON array path equals including JsonNull/DbNull/AnyNull [connectors: exclude:mysql caps:jsonfiltering,jsonfilteringarraypath]
- [ ] `queries::filters::json_filters::extract_json_path` — filters by JSON path string expression with equals and null variants [connectors: only:mysql exclude:mysql caps:jsonfiltering,jsonfilteringjsonpath]
- [ ] `queries::filters::json_filters::array_contains_pg_json` — array_contains filter on native pg Json column [connectors: only:postgres exclude:mysql caps:jsonfiltering]
- [ ] `queries::filters::json_filters::array_contains` — array_contains and NOT array_contains on JSON arrays [connectors: exclude:mysql,sqlite caps:jsonfiltering]
- [ ] `queries::filters::json_filters::array_starts_with_pg_json` — array_starts_with on native pg Json column [connectors: only:postgres exclude:mysql caps:jsonfiltering]
- [ ] `queries::filters::json_filters::array_starts_with` — array_starts_with and NOT array_starts_with on JSON arrays [connectors: exclude:mysql caps:jsonfiltering]
- [ ] `queries::filters::json_filters::array_ends_with_pg_json` — array_ends_with on native pg Json column [connectors: only:postgres exclude:mysql caps:jsonfiltering]
- [ ] `queries::filters::json_filters::array_ends_with` — array_ends_with and NOT array_ends_with on JSON arrays [connectors: exclude:mysql caps:jsonfiltering]
- [ ] `queries::filters::json_filters::string_contains_pg_json` — string_contains on native pg Json column [connectors: only:postgres exclude:mysql caps:jsonfiltering]
- [ ] `queries::filters::json_filters::string_contains` — string_contains including insensitive mode and NOT [connectors: exclude:mysql caps:jsonfiltering]
- [ ] `queries::filters::json_filters::string_starts_with_pg_json` — string_starts_with on native pg Json column [connectors: only:postgres exclude:mysql caps:jsonfiltering]
- [ ] `queries::filters::json_filters::string_starts_with` — string_starts_with including insensitive mode and NOT [connectors: exclude:mysql caps:jsonfiltering]
- [ ] `queries::filters::json_filters::string_ends_with_pg_json` — string_ends_with on native pg Json column [connectors: only:postgres exclude:mysql caps:jsonfiltering]
- [ ] `queries::filters::json_filters::string_ends_with` — string_ends_with including insensitive mode and NOT [connectors: exclude:mysql caps:jsonfiltering]
- [ ] `queries::filters::json_filters::gt_gte_pg_json` — gt/gte JSON value comparisons on native pg Json column [connectors: only:postgres exclude:mysql,cockroachdb caps:jsonfiltering]
- [ ] `queries::filters::json_filters::cockroach_errors_on_json_gt_lt` — CockroachDB errors (2009) on JSON gt/lt comparisons [connectors: only:cockroachdb exclude:mysql caps:jsonfiltering]
- [ ] `queries::filters::json_filters::gt_gte` — gt/gte JSON value comparisons [connectors: only:postgres exclude:mysql,cockroachdb caps:jsonfiltering]
- [ ] `queries::filters::json_filters::lt_lte_pg_json` — lt/lte JSON value comparisons on native pg Json column [connectors: only:postgres exclude:mysql,cockroachdb caps:jsonfiltering]
- [ ] `queries::filters::json_filters::lt_lte` — lt/lte JSON value comparisons [connectors: only:postgres exclude:mysql,cockroachdb caps:jsonfiltering]
- [ ] `queries::filters::json_filters::multi_filtering_pg_json` — combined JSON filters with cursor/take and NOT on native pg Json column [connectors: only:postgres exclude:mysql,cockroachdb caps:jsonfiltering]
- [ ] `queries::filters::json_filters::multi_filtering` — combined JSON filters (array, gte/lt, NOT) with cursor and pagination [connectors: only:postgres exclude:mysql,cockroachdb caps:jsonfiltering]
- [ ] `queries::filters::json_filters::string_contains_does_not_error` — string_contains on optional Json returns null without erroring [connectors: exclude:mysql caps:jsonfiltering]
- [ ] `queries::filters::json_filters::string_begins_with_does_not_error` — string_starts_with on optional Json returns null without erroring [connectors: exclude:mysql caps:jsonfiltering]
- [ ] `queries::filters::json_filters::string_ends_with_does_not_error` — string_ends_with on optional Json returns null without erroring [connectors: exclude:mysql caps:jsonfiltering]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/list_filters.rs
- [ ] `queries::filters::list_filters::equality` — scalar list equals/not for all base types [connectors: caps:scalarlists]
- [ ] `queries::filters::list_filters::has` — scalar list has/not-has for all base types [connectors: caps:scalarlists]
- [ ] `queries::filters::list_filters::has_some` — scalar list hasSome/not for all base types [connectors: caps:scalarlists]
- [ ] `queries::filters::list_filters::has_every` — scalar list hasEvery/not for all base types [connectors: caps:scalarlists]
- [ ] `queries::filters::list_filters::is_empty` — scalar list isEmpty/not for all base types [connectors: caps:scalarlists]
- [ ] `queries::filters::list_filters::is_empty_bytes` — bytes list isEmpty/not filter [connectors: exclude:cockroachdb caps:scalarlists]
- [ ] `queries::filters::list_filters::has_every_empty` — string list hasEvery empty array matches all [connectors: caps:scalarlists]
- [ ] `queries::filters::list_filters::equality` — decimal list equals/not filter [connectors: caps:scalarlists,decimaltype]
- [ ] `queries::filters::list_filters::has` — decimal list has/not filter [connectors: caps:scalarlists,decimaltype]
- [ ] `queries::filters::list_filters::has_some` — decimal list hasSome/not filter [connectors: caps:scalarlists,decimaltype]
- [ ] `queries::filters::list_filters::has_every` — decimal list hasEvery/not filter [connectors: caps:scalarlists,decimaltype]
- [ ] `queries::filters::list_filters::is_empty` — decimal list isEmpty/not filter [connectors: caps:scalarlists,decimaltype]
- [ ] `queries::filters::list_filters::has_every_empty` — decimal list hasEvery empty array matches all [connectors: caps:scalarlists,decimaltype]
- [ ] `queries::filters::list_filters::equality` — json list equals/not filter [connectors: exclude:cockroachdb caps:scalarlists,json]
- [ ] `queries::filters::list_filters::has` — json list has/not filter [connectors: exclude:cockroachdb caps:scalarlists,json]
- [ ] `queries::filters::list_filters::has_some` — json list hasSome/not filter [connectors: exclude:cockroachdb caps:scalarlists,json]
- [ ] `queries::filters::list_filters::has_every` — json list hasEvery/not filter [connectors: exclude:cockroachdb caps:scalarlists,json]
- [ ] `queries::filters::list_filters::is_empty` — json list isEmpty/not filter [connectors: exclude:cockroachdb caps:scalarlists,json]
- [ ] `queries::filters::list_filters::equality` — enum list equals/not filter [connectors: exclude:cockroachdb caps:scalarlists,enums]
- [ ] `queries::filters::list_filters::has` — enum list has/not filter [connectors: caps:scalarlists,enums]
- [ ] `queries::filters::list_filters::has_some` — enum list hasSome/not filter [connectors: caps:scalarlists,enums]
- [ ] `queries::filters::list_filters::has_every` — enum list hasEvery/not filter [connectors: caps:scalarlists,enums]
- [ ] `queries::filters::list_filters::is_empty` — enum list isEmpty/not filter [connectors: exclude:cockroachdb caps:scalarlists,enums]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/many_relation.rs
- [ ] `queries::filters::many_relation::simple_scalar_filter` — nested posts filtered by popularity gte [connectors: all]
- [ ] `queries::filters::many_relation::l1_1_rel` — posts filtered by to-one blog name is [connectors: all]
- [ ] `queries::filters::many_relation::l1_m_rel_some` — blogs filtered by posts some including AND combinations [connectors: all]
- [ ] `queries::filters::many_relation::l1_m_rel_every` — blogs filtered by posts every popularity [connectors: all]
- [ ] `queries::filters::many_relation::l1_m_rel_none` — blogs filtered by posts none popularity [connectors: all]
- [ ] `queries::filters::many_relation::l2_m_rel_some_some` — blogs filtered by posts some comments some likes [connectors: all]
- [ ] `queries::filters::many_relation::l2_m_rel_all` — blogs filtered by two-level posts/comments all some/every/none combinations [connectors: all]
- [ ] `queries::filters::many_relation::l2_m_1_rel_all` — blogs filtered by posts to-one comment is/isNot all combinations [connectors: all]
- [ ] `queries::filters::many_relation::crazy_filters` — posts filtered by combined blog is and comments none/some [connectors: all]
- [ ] `queries::filters::many_relation::m2m_join_relation_1level` — m2m authors/posts join with startsWith and some filters [connectors: all]
- [ ] `queries::filters::many_relation::prisma_25103` — nested subscriptions where optedOutAt/audience deletedAt null regression [connectors: exclude:mssql]
- [ ] `queries::filters::many_relation::prisma_25104` — nested bs filtered by cs every name regression [connectors: exclude:mongo]
- [ ] `queries::filters::many_relation::prisma_23742` — nested m2m bottoms filtered by tops some id regression [connectors: exclude:mssql]
- [ ] `queries::filters::many_relation::nested_some_filter_m2m_different_pk` — nested m2m bottoms filtered by tops some with different pk names [connectors: exclude:mssql]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/one2one_regression.rs
- [ ] `queries::filters::one2one_regression::work_with_nulls` — self 1:1 friend/friendOf is null filters [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/one_relation.rs
- [ ] `queries::filters::one_relation::basic_scalar` — scalar title equals filter on Post [connectors: all]
- [ ] `queries::filters::one_relation::l1_one_rel` — 1-level to-one is/isNot relation filters incl null [connectors: all]
- [ ] `queries::filters::one_relation::l1_one_rel_shorthands` — 1-level to-one relation filters with shorthands incl null [connectors: all]
- [ ] `queries::filters::one_relation::l2_one_rel` — 2-level nested to-one relation filter [connectors: all]
- [ ] `queries::filters::one_relation::nested_to_one_filter` — nested to-one read filter on Blog.post [connectors: all]
- [ ] `queries::filters::one_relation::nested_req_to_one_filter_should_fail` — where on required to-one nested read errors [connectors: all]
- [ ] `queries::filters::one_relation::crazy_filters` — deeply nested combined relation and scalar filters [connectors: all]
- [ ] `queries::filters::one_relation::one2one_join_relation_1level` — 1:1 join relation reads and 1-level filter [connectors: exclude:mssql]
- [ ] `queries::filters::one_relation::repro_21356` — some filter through compound-fk relation (prisma#21356) [connectors: all]
- [ ] `queries::filters::one_relation::repro_21366` — some filter through unique-fk relation (prisma#21366) [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/ported_filters.rs
- [ ] `queries::filters::ported_filters::l1_and` — top-level AND of multiple scalar conditions, also under a relation filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::l2_and` — nested AND inside an AND branch, also under a relation filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::l1_or` — top-level OR combined with a scalar condition [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::l2_or` — nested OR inside an OR branch [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::filter_null` — null filtering via equals/not/in and nested not on optional string [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::str_eq` — string equals filter, plain and under relation [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::str_not_eq` — string not equals filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::str_contains` — string contains filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::str_not_contains` — string not contains filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::str_starts_with` — string startsWith filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::str_not_starts_with` — string not startsWith filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::str_ends_with` — string endsWith filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::str_not_ends_with` — string not endsWith filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::str_lt` — string lt filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::str_lte` — string lte filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::str_gt` — string gt filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::str_gte` — string gte filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::str_in` — string in filter with various lists including empty [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::str_not_in` — string notIn filter including empty list [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::int_eq` — int equals filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::int_not_eq` — int not equals filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::int_lt` — int lt filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::int_lte` — int lte filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::int_gt` — int gt filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::int_gte` — int gte filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::int_in` — int in filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::int_not_in` — int notIn filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::float_eq` — float equals filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::float_not_eq` — float not equals filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::float_lt` — float lt filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::float_lte` — float lte filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::float_gt` — float gt filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::float_gte` — float gte filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::float_in` — float in filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::float_not_in` — float notIn filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::bool_eq` — boolean equals filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::bool_not_eq` — boolean not equals filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::dt_eq` — datetime equals filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::dt_not_eq` — datetime not equals filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::dt_lt` — datetime lt filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::dt_lte` — datetime lte filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::dt_gt` — datetime gt filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::dt_gte` — datetime gte filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::dt_in` — datetime in filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::dt_not_in` — datetime notIn filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::enum_eq` — enum equals filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::enum_not_eq` — enum not equals filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::enum_in` — enum in filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::enum_not_in` — enum notIn filter [connectors: caps:enums]
- [ ] `queries::filters::ported_filters::not_alias_equal` — NOT with combined conditions and NOT list equivalence [connectors: caps:enums]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/relation_null.rs
- [ ] `queries::filters::relation_null::is_null` — to-one relation is null filter on both sides [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/search_filter.rs
- [ ] `queries::filters::search_filter::search_single_field` — single field search filter without index [connectors: caps:nativefulltextsearchwithoutindex]
- [ ] `queries::filters::search_filter::search_many_fields` — multiple field search filter without index [connectors: caps:nativefulltextsearchwithoutindex]
- [ ] `queries::filters::search_filter::search_nullable_field` — nullable field search filter without index [connectors: caps:nativefulltextsearchwithoutindex]
- [ ] `queries::filters::search_filter::search_with_other_filters` — search combined with other scalar filters without index [connectors: caps:nativefulltextsearchwithoutindex]
- [ ] `queries::filters::search_filter::search_many_fields_not` — NOT search across fields without index [connectors: caps:nativefulltextsearchwithoutindex]
- [ ] `queries::filters::search_filter::ensure_filter_tree_shake_works` — nested AND/OR/NOT search filter tree-shake without index [connectors: caps:nativefulltextsearchwithoutindex]
- [ ] `queries::filters::search_filter::search_single_field` — single field search filter with index [connectors: caps:nativefulltextsearchwithindex]
- [ ] `queries::filters::search_filter::search_many_fields` — multiple field search filter with index [connectors: caps:nativefulltextsearchwithindex]
- [ ] `queries::filters::search_filter::search_nullable_field` — nullable field search filter with index [connectors: caps:nativefulltextsearchwithindex]
- [ ] `queries::filters::search_filter::search_with_other_filters` — search combined with other scalar filters with index [connectors: caps:nativefulltextsearchwithindex]
- [ ] `queries::filters::search_filter::search_many_fields_not` — NOT search across fields with index [connectors: caps:nativefulltextsearchwithindex]
- [ ] `queries::filters::search_filter::ensure_filter_tree_shake_works` — nested AND/OR/NOT search filter tree-shake with index [connectors: caps:nativefulltextsearchwithindex]
- [ ] `queries::filters::search_filter::throws_error_on_missing_index` — search on unindexed field errors 2030 missing fulltext index [connectors: caps:nativefulltextsearchwithindex]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/self_relation.rs
- [ ] `queries::filters::self_relation::l1_query` — songs filtered by creator name is one level [connectors: exclude:mssql,sqlite]
- [ ] `queries::filters::self_relation::l2_query` — songs filtered by creator daughters some two levels [connectors: exclude:mssql,sqlite]
- [ ] `queries::filters::self_relation::l2_one2one` — songs filtered by creator wife is two levels [connectors: exclude:mssql,sqlite]
- [ ] `queries::filters::self_relation::one2one_null` — songs filtered by creator wife is null [connectors: exclude:mssql,sqlite]
- [ ] `queries::filters::self_relation::one2one_empty` — songs filtered by creator wife is empty filter [connectors: exclude:mssql,sqlite]
- [ ] `queries::filters::self_relation::one2one_null_fail` — daughters none null filter errors 2009 [connectors: exclude:mssql,sqlite]
- [ ] `queries::filters::self_relation::one2many_empty` — songs filtered by creator daughters some empty filter [connectors: exclude:mssql,sqlite]
- [ ] `queries::filters::self_relation::many2many_some` — songs filtered by creator fans some name [connectors: exclude:mssql,sqlite]
- [ ] `queries::filters::self_relation::many2many_none` — songs filtered by creator fans none name [connectors: exclude:mssql,sqlite]
- [ ] `queries::filters::self_relation::many2many_every` — songs filtered by creator fans every name [connectors: exclude:mssql,sqlite]
- [ ] `queries::filters::self_relation::many2many_null_error` — nested fans some null filter errors 2009 [connectors: exclude:mssql,sqlite]
- [ ] `queries::filters::self_relation::many2many_empty_some` — songs filtered by creator fans some empty filter [connectors: exclude:mssql,sqlite]
- [ ] `queries::filters::self_relation::many2many_empty_none` — humans filtered by fans none empty filter [connectors: exclude:mssql,sqlite]
- [ ] `queries::filters::self_relation::many2many_empty_every` — humans filtered by fans every empty filter [connectors: exclude:mssql,sqlite]
- [ ] `queries::filters::self_relation::many2one` — humans filtered by singer is name [connectors: exclude:mssql,sqlite]
- [ ] `queries::filters::self_relation::many2one_empty_filter` — humans filtered by singer is empty filter [connectors: exclude:mssql,sqlite]
- [ ] `queries::filters::self_relation::many2one_null_filter` — humans filtered by singer is null [connectors: exclude:mssql,sqlite]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/self_relation_regression.rs
- [ ] `queries::filters::self_relation_regression::all_categories` — self-relation list ordered by name with parent [connectors: all]
- [ ] `queries::filters::self_relation_regression::root_categories` — self-relation parent is null filter [connectors: all]
- [ ] `queries::filters::self_relation_regression::inverted_subcat` — self-relation NOT parent is null filter [connectors: all]
- [ ] `queries::filters::self_relation_regression::subcat_scalar` — self-relation parent scalar name filter [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/uuid_filters.rs
- [ ] `queries::filters::uuid_filters::contains_filter_is_rejected` — uuid equality works but contains filter is rejected [connectors: only:postgres,cockroachdb]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/filters/where_unique.rs
- [ ] `queries::filters::where_unique::no_unique_fields` — findUnique errors when where clause is empty [connectors: all]
- [ ] `queries::filters::where_unique::one_unique_field` — findUnique by single unique field [connectors: all]
- [ ] `queries::filters::where_unique::implicit_unique_and` — findUnique by id via implicit AND [connectors: all]
- [ ] `queries::filters::where_unique::where_unique_fails_if_not_unique` — findUnique errors for non-unique or partial-compound fields [connectors: all]
- [ ] `queries::filters::where_unique::where_unique_works_if_unique` — findUnique by unique fields plus extra non-unique/OR filters [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/order_and_pagination/nested_multi_order_pagination.rs
- [ ] `queries::order_and_pagination::nested_multi_order_pagination::take_first_child_each_parent` — take:1 on 1:m relation with multi-field stable orderBy returns first child per parent [connectors: all]
- [ ] `queries::order_and_pagination::nested_multi_order_pagination::take_last_child_each_parent` — take:-1 on 1:m relation with multi-field stable orderBy returns last child per parent [connectors: all]
- [ ] `queries::order_and_pagination::nested_multi_order_pagination::cursor_child_3` — cursor on child id 3 with multi-field stable orderBy on 1:m relation [connectors: all]
- [ ] `queries::order_and_pagination::nested_multi_order_pagination::take_first_child_each_parent` — take:1 on 1:m relation with multi-field unstable orderBy returns first child per parent [connectors: all]
- [ ] `queries::order_and_pagination::nested_multi_order_pagination::take_last_child_each_parent` — take:-1 on 1:m relation with multi-field unstable orderBy returns last child per parent [connectors: all]
- [ ] `queries::order_and_pagination::nested_multi_order_pagination::cursor_child_3` — cursor on child id 3 with multi-field unstable orderBy on 1:m relation [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/order_and_pagination/nested_pagination.rs
- [ ] `queries::order_and_pagination::nested_pagination::all_data_there` — findManyTop returns full nested Top/Middle/Bottom tree [connectors: all]
- [ ] `queries::order_and_pagination::nested_pagination::mid_lvl_cursor` — nested middles cursor returns items from cursor onward per top [connectors: all]
- [ ] `queries::order_and_pagination::nested_pagination::mid_lvl_skip_1` — nested middles skip 1 drops first middle per top [connectors: all]
- [ ] `queries::order_and_pagination::nested_pagination::mid_lvl_skip_3` — nested middles skip 3 returns no middles [connectors: all]
- [ ] `queries::order_and_pagination::nested_pagination::mid_lvl_skip_4` — nested middles skip 4 returns no middles [connectors: all]
- [ ] `queries::order_and_pagination::nested_pagination::bottom_lvl_skip_0` — nested bottoms skip 0 returns all bottoms [connectors: all]
- [ ] `queries::order_and_pagination::nested_pagination::bottom_lvl_skip_1` — nested bottoms skip 1 drops first bottom [connectors: all]
- [ ] `queries::order_and_pagination::nested_pagination::bottom_lvl_skip_3` — nested bottoms skip 3 returns no bottoms [connectors: all]
- [ ] `queries::order_and_pagination::nested_pagination::bottom_lvl_skip_4` — nested bottoms skip 4 returns no bottoms [connectors: all]
- [ ] `queries::order_and_pagination::nested_pagination::mid_lvl_take_0` — nested middles take 0 returns no middles [connectors: all]
- [ ] `queries::order_and_pagination::nested_pagination::mid_lvl_take_1` — nested middles take 1 returns first middle [connectors: all]
- [ ] `queries::order_and_pagination::nested_pagination::mid_lvl_take_3` — nested middles take 3 returns all middles [connectors: all]
- [ ] `queries::order_and_pagination::nested_pagination::mid_lvl_take_4` — nested middles take 4 returns all middles [connectors: all]
- [ ] `queries::order_and_pagination::nested_pagination::bottom_lvl_take_0` — nested bottoms take 0 returns no bottoms [connectors: all]
- [ ] `queries::order_and_pagination::nested_pagination::bottom_lvl_take_1` — nested bottoms take 1 returns first bottom [connectors: all]
- [ ] `queries::order_and_pagination::nested_pagination::bottom_lvl_take_3` — nested bottoms take 3 returns all bottoms [connectors: all]
- [ ] `queries::order_and_pagination::nested_pagination::bottom_lvl_take_4` — nested bottoms take 4 returns all bottoms [connectors: all]
- [ ] `queries::order_and_pagination::nested_pagination::mid_lvl_take_minus_1` — nested middles take -1 returns last middle [connectors: all]
- [ ] `queries::order_and_pagination::nested_pagination::mid_lvl_take_minus_3` — nested middles take -3 returns all middles [connectors: all]
- [ ] `queries::order_and_pagination::nested_pagination::mid_lvl_take_minus_4` — nested middles take -4 returns all middles [connectors: all]
- [ ] `queries::order_and_pagination::nested_pagination::bottom_lvl_take_minus_1` — nested bottoms take -1 returns last bottom [connectors: all]
- [ ] `queries::order_and_pagination::nested_pagination::bottom_lvl_take_minus_3` — nested bottoms take -3 returns all bottoms [connectors: all]
- [ ] `queries::order_and_pagination::nested_pagination::bottom_lvl_take_minus_4` — nested bottoms take -4 returns all bottoms [connectors: all]
- [ ] `queries::order_and_pagination::nested_pagination::top_lvl_skip_1_take_1` — top skip 1 take 1 returns second top with its middles [connectors: all]
- [ ] `queries::order_and_pagination::nested_pagination::top_lvl_skip_1_take_3` — top skip 1 take 3 returns last two tops [connectors: all]
- [ ] `queries::order_and_pagination::nested_pagination::mid_lvl_skip_1_take_1` — nested middles skip 1 take 1 returns second middle [connectors: all]
- [ ] `queries::order_and_pagination::nested_pagination::mid_lvl_skip_1_take_3` — nested middles skip 1 take 3 returns last two middles [connectors: all]
- [ ] `queries::order_and_pagination::nested_pagination::top_lvl_skip_1_take_minus_3` — top skip 1 take -3 returns first two tops [connectors: all]
- [ ] `queries::order_and_pagination::nested_pagination::mid_lvl_skip_1_take_minus_1` — nested middles skip 1 take -1 returns second middle [connectors: all]
- [ ] `queries::order_and_pagination::nested_pagination::mid_lvl_skip_1_take_minus_3` — nested middles skip 1 take -3 returns first two middles [connectors: all]
- [ ] `queries::order_and_pagination::nested_pagination::mid_order_by_take_1` — nested middles orderBy desc take 1 returns last middle [connectors: all]
- [ ] `queries::order_and_pagination::nested_pagination::mid_lvl_order_by_take_3` — nested middles orderBy desc take 3 returns all in reverse [connectors: all]
- [ ] `queries::order_and_pagination::nested_pagination::m2m_many_children_nested_cursor` — m2m nested cursor pagination across shared children [connectors: all]
- [ ] `queries::order_and_pagination::nested_pagination::m2m_many_children_nested_cursor_skip_take` — m2m nested cursor with skip/take/negative-take [connectors: all]
- [ ] `queries::order_and_pagination::nested_pagination::m2m_many_children_nested_skip_take` — m2m nested skip/take pagination without cursor [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/order_and_pagination/order_by.rs
- [ ] `queries::order_and_pagination::order_by::unique_asc` — orders by unique field ascending [connectors: all]
- [ ] `queries::order_and_pagination::order_by::unique_desc` — orders by unique field descending [connectors: all]
- [ ] `queries::order_and_pagination::order_by::multiple_fields_basic` — orders by two fields both descending [connectors: all]
- [ ] `queries::order_and_pagination::order_by::multiple_fields_ordering` — honors order of multiple ordering fields in query [connectors: all]
- [ ] `queries::order_and_pagination::order_by::negative_cursor` — negative take with descending orderBy [connectors: all]
- [ ] `queries::order_and_pagination::order_by::empty_order_objects` — empty orderBy objects fall back to default ordering [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/order_and_pagination/order_by_aggregation.rs
- [ ] `queries::order_and_pagination::order_by_aggregation::one2m_count_asc` — order users by posts _count asc [connectors: all]
- [ ] `queries::order_and_pagination::order_by_aggregation::one2m_count_desc` — order users by posts _count desc [connectors: all]
- [ ] `queries::order_and_pagination::order_by_aggregation::m2m_count_asc` — order posts by categories _count asc [connectors: all]
- [ ] `queries::order_and_pagination::order_by_aggregation::m2m_count_desc` — order posts by categories _count desc [connectors: all]
- [ ] `queries::order_and_pagination::order_by_aggregation::one2m_count_asc_field_asc` — order users by posts _count asc then name asc [connectors: all]
- [ ] `queries::order_and_pagination::order_by_aggregation::one2m_count_asc_field_desc` — order users by name desc then posts _count asc [connectors: all]
- [ ] `queries::order_and_pagination::order_by_aggregation::m2m_count_asc_field_desc` — order posts by categories _count asc then title asc [connectors: all]
- [ ] `queries::order_and_pagination::order_by_aggregation::one2m_field_asc_m2m_count_desc` — order posts by user name asc then categories _count desc [connectors: all]
- [ ] `queries::order_and_pagination::order_by_aggregation::m2one2m_count_asc` — order posts by user categories _count asc [connectors: all]
- [ ] `queries::order_and_pagination::order_by_aggregation::m2one2m_count_desc` — order posts by user categories _count desc, tolerant match [connectors: all]
- [ ] `queries::order_and_pagination::order_by_aggregation::m2m_count_asc_m2one2m_count_desc` — order posts by categories _count asc then user categories _count desc [connectors: all]
- [ ] `queries::order_and_pagination::order_by_aggregation::m2one_field_asc_m2one2m_count_desc` — order posts by user name asc then user categories _count desc, connector-specific [connectors: all]
- [ ] `queries::order_and_pagination::order_by_aggregation::m2one2one2m_count_asc` — order A by b.c.ds _count asc across 3+ hops [connectors: all]
- [ ] `queries::order_and_pagination::order_by_aggregation::m2one2one2m_count_desc` — order A by b.c.ds _count desc across 3+ hops [connectors: all]
- [ ] `queries::order_and_pagination::order_by_aggregation::cursor_one2m_count_asc` — cursor + order users by posts _count asc [connectors: all]
- [ ] `queries::order_and_pagination::order_by_aggregation::cursor_one2m_count_desc` — cursor + order users by posts _count desc [connectors: all]
- [ ] `queries::order_and_pagination::order_by_aggregation::cursor_m2m_count_asc` — cursor + take order posts by categories _count asc [connectors: all]
- [ ] `queries::order_and_pagination::order_by_aggregation::cursor_m2m_count_desc` — cursor + take order posts by categories _count desc [connectors: all]
- [ ] `queries::order_and_pagination::order_by_aggregation::cursor_one2m_count_asc_field_asc` — cursor + order users by posts _count asc then name asc [connectors: all]
- [ ] `queries::order_and_pagination::order_by_aggregation::cursor_one2m_count_asc_field_desc` — cursor + take order users by name desc then posts _count asc [connectors: all]
- [ ] `queries::order_and_pagination::order_by_aggregation::cursor_m2m_count_asc_field_desc` — cursor + take order posts by categories _count asc then title asc [connectors: all]
- [ ] `queries::order_and_pagination::order_by_aggregation::cursor_one2m_field_asc_m2m_count_desc` — cursor + take order posts by user name asc then categories _count desc [connectors: all]
- [ ] `queries::order_and_pagination::order_by_aggregation::cursor_m2one2m_count_asc` — cursor + take order posts by user categories _count asc [connectors: all]
- [ ] `queries::order_and_pagination::order_by_aggregation::cursor_m2one2m_count_desc` — cursor + take order posts by user categories _count desc [connectors: all]
- [ ] `queries::order_and_pagination::order_by_aggregation::cursor_m2m_count_asc_m2one2m_count_desc` — cursor + take order posts by categories _count asc then user categories _count desc [connectors: all]
- [ ] `queries::order_and_pagination::order_by_aggregation::cursor_m2one_field_asc_m2one2m_count_desc` — cursor + take order posts by user name asc then user categories _count desc [connectors: all]
- [ ] `queries::order_and_pagination::order_by_aggregation::cursor_m2one2one2m_count_desc` — cursor + take order A by b.c.ds _count desc across 3+ hops [connectors: all]
- [ ] `queries::order_and_pagination::order_by_aggregation::count_m2m_records_not_connected` — regression 8036 count m2m with cursor/skip/take for unconnected records [connectors: all]
- [ ] `queries::order_and_pagination::order_by_aggregation::nested_one2m_count` — nested order bs by c.d.es _count asc/desc across 2+ hops [connectors: all]
- [ ] `queries::order_and_pagination::order_by_aggregation::nested_m2m_count` — regression 22926 nested order bs by c.d es/fs _count across hops [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/order_and_pagination/order_by_composite.rs
- [ ] `queries::order_and_pagination::order_by_composite::model_basic_ordering_single` — orders model by single to-one composite hop, required and optional [connectors: only:mongo]
- [ ] `queries::order_and_pagination::order_by_composite::model_basic_ordering_multiple` — orders model by multiple to-one composite hops [connectors: only:mongo]
- [ ] `queries::order_and_pagination::order_by_composite::model_multi_ordering` — orders model by multiple composite orderings at once [connectors: only:mongo]
- [ ] `queries::order_and_pagination::order_by_composite::cursored_ordering` — cursor ordering by single to-one composites, various hop configs [connectors: only:mongo]
- [ ] `queries::order_and_pagination::order_by_composite::multi_order_cursor` — cursor ordering by multiple to-one composites [connectors: only:mongo]
- [ ] `queries::order_and_pagination::order_by_composite::model_basic_ordering_many` — orders model by to-many composite _count [connectors: only:mongo]
- [ ] `queries::order_and_pagination::order_by_composite::model_basic_to_many_ordering_multiple_hops` — orders model by to-many _count reached over to-one composite hops [connectors: only:mongo]
- [ ] `queries::order_and_pagination::order_by_composite::model_basic_ordering_multiple` — orders model by multiple orderings including to-many composites [connectors: only:mongo]
- [ ] `queries::order_and_pagination::order_by_composite::cursored_ordering_base` — cursor ordering by single to-many composite _count [connectors: only:mongo]
- [ ] `queries::order_and_pagination::order_by_composite::cursored_ordering_over_to_one` — cursor ordering by to-many _count over a to-one composite [connectors: only:mongo]
- [ ] `queries::order_and_pagination::order_by_composite::model_cursored_ordering_multiple` — cursor ordering by multiple to-many composite _counts [connectors: only:mongo]
- [ ] `queries::order_and_pagination::order_by_composite::composite_over_rel_ordering` — orders model by composites over a relation, null handling [connectors: only:mongo]
- [ ] `queries::order_and_pagination::order_by_composite::cursored_composite_over_rel_ordering` — cursor ordering by composites over a relation [connectors: only:mongo]
- [ ] `queries::order_and_pagination::order_by_composite::composite_aggr_over_rel_ordering` — orders model by composite aggregation _count over a relation [connectors: only:mongo]
- [ ] `queries::order_and_pagination::order_by_composite::composite_aggr_over_rel_composite_ordering` — orders model by composite aggregation over a relation plus a composite hop [connectors: only:mongo]
- [ ] `queries::order_and_pagination::order_by_composite::order_related_by_to_one_composite` — orders a related model on a to-one composite [connectors: only:mongo]
- [ ] `queries::order_and_pagination::order_by_composite::cursored_order_related_by_to_one_composite` — orders a related model on a to-one composite with cursor [connectors: only:mongo]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/order_and_pagination/order_by_dependent.rs
- [ ] `queries::order_and_pagination::order_by_dependent::hop_1_related_record_asc` — orders by 1-hop related record field ascending [connectors: exclude:mssql]
- [ ] `queries::order_and_pagination::order_by_dependent::hop_1_related_record_desc` — orders by 1-hop related record field descending [connectors: exclude:mssql]
- [ ] `queries::order_and_pagination::order_by_dependent::hop_1_related_record_asc_nulls` — orders by 1-hop related record ascending with nulls, connector-specific null placement [connectors: all]
- [ ] `queries::order_and_pagination::order_by_dependent::hop_2_related_record_asc` — orders by 2-hop related record field ascending [connectors: exclude:mssql]
- [ ] `queries::order_and_pagination::order_by_dependent::hop_2_related_record_desc` — orders by 2-hop related record field descending [connectors: exclude:mssql]
- [ ] `queries::order_and_pagination::order_by_dependent::hop_2_related_record_asc_null` — orders by 2-hop related record ascending with nulls, connector-specific null placement [connectors: all]
- [ ] `queries::order_and_pagination::order_by_dependent::circular_related_record_asc` — orders by circular related record field ascending [connectors: all]
- [ ] `queries::order_and_pagination::order_by_dependent::circular_related_record_desc` — orders by circular related record field descending [connectors: all]
- [ ] `queries::order_and_pagination::order_by_dependent::circular_diff_related_record_asc` — orders by circular related record ascending with differing records and nulls [connectors: exclude:mssql]
- [ ] `queries::order_and_pagination::order_by_dependent::circular_diff_related_record_desc` — orders by circular related record descending with differing records and nulls [connectors: exclude:mssql]
- [ ] `queries::order_and_pagination::order_by_dependent::multiple_rel_same_model_order_by` — orders by two relations to the same model [connectors: all]
- [ ] `queries::order_and_pagination::order_by_dependent::simple_order_by_rel` — basic order by 1-hop relation with no-double-nulls schema [connectors: all]
- [ ] `queries::order_and_pagination::order_by_dependent::hop_2_simple_order_by_rel` — basic order by 2-hop relation with no-double-nulls schema [connectors: all]
- [ ] `queries::order_and_pagination::order_by_dependent::self_relation_works` — orders by nested self-relation hops (regression prisma/prisma#12003) [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/order_and_pagination/order_by_dependent_pagination.rs
- [ ] `queries::order_and_pagination::order_by_dependent_pagination::hop_1_related_record_asc` — cursor+take paging ordered by 1-hop related record ascending [connectors: exclude:mssql]
- [ ] `queries::order_and_pagination::order_by_dependent_pagination::hop_1_related_record_desc` — cursor+take paging ordered by 1-hop related record descending [connectors: exclude:mssql]
- [ ] `queries::order_and_pagination::order_by_dependent_pagination::hop_1_related_record_asc_nulls` — cursor+take paging ordered by 1-hop related record ascending with nulls [connectors: exclude:mssql]
- [ ] `queries::order_and_pagination::order_by_dependent_pagination::hop_2_related_record_asc` — cursor+take paging ordered by 2-hop related record ascending [connectors: exclude:mssql]
- [ ] `queries::order_and_pagination::order_by_dependent_pagination::hop_2_related_record_desc` — cursor+take paging ordered by 2-hop related record descending [connectors: exclude:mssql]
- [ ] `queries::order_and_pagination::order_by_dependent_pagination::hop_2_related_record_asc_null` — cursor+take paging ordered by 2-hop related record ascending with nulls [connectors: exclude:mssql]
- [ ] `queries::order_and_pagination::order_by_dependent_pagination::circular_related_record_asc` — cursor+take paging ordered by circular related record ascending [connectors: all]
- [ ] `queries::order_and_pagination::order_by_dependent_pagination::circular_related_record_desc` — cursor+take paging ordered by circular related record descending [connectors: all]
- [ ] `queries::order_and_pagination::order_by_dependent_pagination::circular_diff_related_record_asc` — cursor+take paging ordered by circular differing records ascending with nulls [connectors: exclude:mssql]
- [ ] `queries::order_and_pagination::order_by_dependent_pagination::circular_diff_related_record_desc` — cursor+take paging ordered by circular differing records descending with nulls [connectors: exclude:mssql]
- [ ] `queries::order_and_pagination::order_by_dependent_pagination::multiple_rel_same_model_order_by` — cursor+take paging ordered by two relations to the same model [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/order_and_pagination/order_by_mutation.rs
- [ ] `queries::order_and_pagination::order_by_mutation::order_by_not_selected` — orderBy field not in the selection set works on createOne nested read [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/order_and_pagination/order_by_nulls.rs
- [ ] `queries::order_and_pagination::order_by_nulls::simple_nulls_first` — orders single field asc/desc with nulls first [connectors: caps:orderbynullsfirstlast]
- [ ] `queries::order_and_pagination::order_by_nulls::simple_nulls_last` — orders single field asc/desc with nulls last [connectors: caps:orderbynullsfirstlast]
- [ ] `queries::order_and_pagination::order_by_nulls::two_fields_nulls_last` — orders by two fields with nulls last across sort combinations [connectors: caps:orderbynullsfirstlast]
- [ ] `queries::order_and_pagination::order_by_nulls::two_fields_nulls_first` — orders by two fields with nulls first across sort combinations [connectors: caps:orderbynullsfirstlast]
- [ ] `queries::order_and_pagination::order_by_nulls::nulls_first_cursor` — cursor paging with nulls-first orderings asc and desc [connectors: caps:orderbynullsfirstlast]
- [ ] `queries::order_and_pagination::order_by_nulls::nulls_last_cursor` — cursor paging with nulls-last orderings asc and desc [connectors: caps:orderbynullsfirstlast]
- [ ] `queries::order_and_pagination::order_by_nulls::nulls_on_required_field_should_fail` — nulls ordering on required field errors 2009 [connectors: caps:orderbynullsfirstlast]
- [ ] `queries::order_and_pagination::order_by_nulls::nulls_on_list_field_should_fail` — nulls ordering on list field errors 2009 [connectors: caps:orderbynullsfirstlast,scalarlists]
- [ ] `queries::order_and_pagination::order_by_nulls::ordering_by_nulls_should_be_optional` — nulls arg is optional in sort object [connectors: caps:orderbynullsfirstlast]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/order_and_pagination/order_by_relevance.rs
- [ ] `queries::order_and_pagination::order_by_relevance::on_unknown_field` — _relevance on unknown field errors 2009 (without index) [connectors: caps:nativefulltextsearchwithoutindex]
- [ ] `queries::order_and_pagination::order_by_relevance::on_single_field` — _relevance orders by single field asc/desc (without index) [connectors: caps:nativefulltextsearchwithoutindex]
- [ ] `queries::order_and_pagination::order_by_relevance::on_single_nullable_field` — _relevance orders by single nullable field asc/desc (without index) [connectors: caps:nativefulltextsearchwithoutindex]
- [ ] `queries::order_and_pagination::order_by_relevance::on_many_fields` — _relevance orders by multiple fields asc/desc (without index) [connectors: caps:nativefulltextsearchwithoutindex]
- [ ] `queries::order_and_pagination::order_by_relevance::on_many_fields_some_nullable` — _relevance orders by multiple fields some nullable (without index) [connectors: caps:nativefulltextsearchwithoutindex]
- [ ] `queries::order_and_pagination::order_by_relevance::many_order_by_stmts` — multiple _relevance orderBy statements combined (without index) [connectors: caps:nativefulltextsearchwithoutindex]
- [ ] `queries::order_and_pagination::order_by_relevance::on_single_field_with_page` — _relevance on single field with cursor pagination (without index) [connectors: caps:nativefulltextsearchwithoutindex]
- [ ] `queries::order_and_pagination::order_by_relevance::on_single_nullable_field_page` — _relevance on single nullable field with pagination (without index) [connectors: caps:nativefulltextsearchwithoutindex]
- [ ] `queries::order_and_pagination::order_by_relevance::on_many_fields_with_pagination` — _relevance on many fields with pagination and scalar orderBy (without index) [connectors: caps:nativefulltextsearchwithoutindex]
- [ ] `queries::order_and_pagination::order_by_relevance::on_many_fields_aggr_pagination` — _relevance on many fields with aggregation and pagination (without index) [connectors: caps:nativefulltextsearchwithoutindex]
- [ ] `queries::order_and_pagination::order_by_relevance::on_1m_relation_field` — _relevance ordering over a 1:m relation field (without index) [connectors: caps:nativefulltextsearchwithoutindex]
- [ ] `queries::order_and_pagination::order_by_relevance::on_unknown_field` — _relevance on unknown field errors 2009 (with index) [connectors: caps:nativefulltextsearchwithindex]
- [ ] `queries::order_and_pagination::order_by_relevance::on_single_field` — _relevance orders by single field asc/desc (with index) [connectors: caps:nativefulltextsearchwithindex]
- [ ] `queries::order_and_pagination::order_by_relevance::on_single_nullable_field` — _relevance orders by single nullable field asc/desc (with index) [connectors: caps:nativefulltextsearchwithindex]
- [ ] `queries::order_and_pagination::order_by_relevance::on_many_fields` — _relevance orders by multiple fields asc/desc (with index) [connectors: caps:nativefulltextsearchwithindex]
- [ ] `queries::order_and_pagination::order_by_relevance::on_many_fields_some_nullable` — _relevance orders by multiple fields some nullable (with index) [connectors: caps:nativefulltextsearchwithindex]
- [ ] `queries::order_and_pagination::order_by_relevance::many_order_by_stmts` — multiple _relevance orderBy statements combined (with index) [connectors: caps:nativefulltextsearchwithindex]
- [ ] `queries::order_and_pagination::order_by_relevance::on_single_field_with_pagination` — _relevance on single field with cursor pagination (with index) [connectors: caps:nativefulltextsearchwithindex]
- [ ] `queries::order_and_pagination::order_by_relevance::on_single_nullable_with_pagination` — _relevance on single nullable field with pagination (with index) [connectors: caps:nativefulltextsearchwithindex]
- [ ] `queries::order_and_pagination::order_by_relevance::on_many_fields_with_pagination` — _relevance on many fields with pagination and scalar orderBy (with index) [connectors: caps:nativefulltextsearchwithindex]
- [ ] `queries::order_and_pagination::order_by_relevance::on_many_fields_aggr_pagination` — _relevance on many fields with aggregation and pagination (with index) [connectors: caps:nativefulltextsearchwithindex]
- [ ] `queries::order_and_pagination::order_by_relevance::on_1m_relation_field` — _relevance ordering over a 1:m relation field (with index) [connectors: caps:nativefulltextsearchwithindex]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/order_and_pagination/pagination.rs
- [ ] `queries::order_and_pagination::pagination::cursor_on_id` — cursor on id returns records from cursor onward [connectors: all]
- [ ] `queries::order_and_pagination::pagination::cursor_id_ordering` — cursor on id with desc order returns cursor and preceding [connectors: all]
- [ ] `queries::order_and_pagination::pagination::cursor_id_order_desc_non_uniq` — cursor on id with desc order on non-unique field [connectors: all]
- [ ] `queries::order_and_pagination::pagination::cursor_id_order_asc_non_uniq` — cursor on id with asc order on non-unique field [connectors: all]
- [ ] `queries::order_and_pagination::pagination::cursor_id_end_of_records` — cursor on last record returns only last record [connectors: all]
- [ ] `queries::order_and_pagination::pagination::cursor_id_first_record_reverse_order` — cursor on first with reversed order returns only first [connectors: all]
- [ ] `queries::order_and_pagination::pagination::cursor_id_non_existing_cursor` — cursor on non-existent id returns no records [connectors: all]
- [ ] `queries::order_and_pagination::pagination::cursor_on_unique` — cursor on unique field works like id cursor [connectors: all]
- [ ] `queries::order_and_pagination::pagination::take_1` — take 1 returns first record [connectors: all]
- [ ] `queries::order_and_pagination::pagination::take_1_reverse_order` — take 1 with reversed order returns last record [connectors: all]
- [ ] `queries::order_and_pagination::pagination::take_0` — take 0 returns no records [connectors: all]
- [ ] `queries::order_and_pagination::pagination::take_minus_1_without_cursor` — take -1 without cursor returns last record [connectors: all]
- [ ] `queries::order_and_pagination::pagination::skip_returns_all_after_offset` — skip returns all records after offset [connectors: all]
- [ ] `queries::order_and_pagination::pagination::skip_reversed_order` — skip with reversed order returns records after offset [connectors: all]
- [ ] `queries::order_and_pagination::pagination::skipping_beyond_all_records` — skip beyond all records returns none [connectors: all]
- [ ] `queries::order_and_pagination::pagination::skip_0_records` — skip 0 returns all records from first [connectors: all]
- [ ] `queries::order_and_pagination::pagination::cursor_take_2` — cursor with take 2 returns cursor plus next [connectors: all]
- [ ] `queries::order_and_pagination::pagination::cursor_take_minus_2` — cursor with take -2 returns cursor plus previous [connectors: all]
- [ ] `queries::order_and_pagination::pagination::cursor_last_record_take_2` — cursor on last with take 2 returns only cursor [connectors: all]
- [ ] `queries::order_and_pagination::pagination::cursor_first_record_take_minus_2` — cursor on first with take -2 returns only cursor [connectors: all]
- [ ] `queries::order_and_pagination::pagination::cursor_take_0` — cursor with take 0 returns no records [connectors: all]
- [ ] `queries::order_and_pagination::pagination::cursor_take_2_reverse_order` — cursor take 2 reversed returns cursor and one before [connectors: all]
- [ ] `queries::order_and_pagination::pagination::cursor_take_minus_2_reverse_order` — cursor take -2 reversed returns cursor and one after [connectors: all]
- [ ] `queries::order_and_pagination::pagination::cursor_take_2_skip_2` — cursor take 2 skip 2 returns two records after next [connectors: all]
- [ ] `queries::order_and_pagination::pagination::cursor_take_minus_2_skip_2` — cursor take -2 skip 2 returns two records before previous [connectors: all]
- [ ] `queries::order_and_pagination::pagination::skip_to_end_with_take` — skipping to end with take returns no records [connectors: all]
- [ ] `queries::order_and_pagination::pagination::cursor_take_0_skip_1` — cursor take 0 with skip returns no records [connectors: all]
- [ ] `queries::order_and_pagination::pagination::cursor_take_2_skip_2_reverse_order` — cursor take 2 skip 2 reversed returns two before record before cursor [connectors: all]
- [ ] `queries::order_and_pagination::pagination::cursor_take_minus_2_skip_2_rev_order` — cursor take -2 skip 2 reversed returns two after record before cursor [connectors: all]
- [ ] `queries::order_and_pagination::pagination::cursor_take_skip_multiple_stable_order` — cursor take/skip with multiple stable orderBys [connectors: all]
- [ ] `queries::order_and_pagination::pagination::cursor_take_skip_multiple_unstable_order` — cursor take/skip with multiple unstable orderBys [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/order_and_pagination/relation_filter_ordering.rs
- [ ] `queries::order_and_pagination::relation_filter_ordering::rel_filters` — orders by score desc with take, with and without relational filter [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/regressions/non_uniq_index.rs
- [ ] `queries::regressions::non_uniq_index::non_uniq_indices` — non-unique index does not enable a unique filter; findUnique on the indexed field errors 2009 [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/regressions/pagination_regression.rs
- [ ] `queries::regressions::pagination_regression::prisma_2855` — duplicate ordering keys on non-sequential IDs still page predictably via cursor (prisma/2855) [connectors: all]
- [ ] `queries::regressions::pagination_regression::prisma_3505_case_1` — paging/ordering with null values with the cursor row on a null row (prisma/3505 case 1) [connectors: all]
- [ ] `queries::regressions::pagination_regression::prisma_3505_case_2` — paging/ordering with null values with the cursor row not on a null row (prisma/3505 case 2) [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/regressions/prisma_1481.rs
- [ ] `queries::regressions::prisma_1481::prisma_1481` — batched executeRaw + updateManyUser returns zero counts (prisma-engines#1481) [connectors: only:sqlite]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/regressions/prisma_3078.rs
- [ ] `queries::regressions::prisma_3078::relation_filter_1_1_a` — relation filter on a 1:1 self relation traversed from both sides (field_a) (prisma/3078) [connectors: exclude:mssql]
- [ ] `queries::regressions::prisma_3078::relation_filter_1_1_z` — relation filter on a 1:1 self relation traversed from both sides (field_z) (prisma/3078) [connectors: exclude:mssql]
- [ ] `queries::regressions::prisma_3078::relation_filter_1_m_a` — relation filter on a 1:M self relation (field_a) (prisma/3078) [connectors: all]
- [ ] `queries::regressions::prisma_3078::relation_filter_1_m_z` — relation filter on a 1:M self relation (field_z) (prisma/3078) [connectors: all]
- [ ] `queries::regressions::prisma_3078::relation_filter_n_m_a` — relation filter on an N:M self relation (field_a) (prisma/3078) [connectors: all]
- [ ] `queries::regressions::prisma_3078::relation_filter_n_m_z` — relation filter on an N:M self relation (field_z) (prisma/3078) [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/regressions/prisma_4088.rs
- [ ] `queries::regressions::prisma_4088::find_many_or_cond_one_filter` — OR condition with one filter applies only that filter (prisma/4088) [connectors: all]
- [ ] `queries::regressions::prisma_4088::find_many_or_cond_two_filters` — OR condition with one undefined filter applies only the defined one (prisma/4088) [connectors: all]
- [ ] `queries::regressions::prisma_4088::find_many_or_cond_no_filter` — OR condition with no filters returns an empty list (prisma/4088) [connectors: all]
- [ ] `queries::regressions::prisma_4088::find_many_and_cond_no_filter` — AND condition with no filters returns all items (prisma/4088) [connectors: all]
- [ ] `queries::regressions::prisma_4088::find_many_and_cond_one_filter` — AND condition with one filter applies only that filter (prisma/4088) [connectors: all]
- [ ] `queries::regressions::prisma_4088::find_many_and_cond_two_filters` — AND condition with one undefined filter applies only the defined one (prisma/4088) [connectors: all]
- [ ] `queries::regressions::prisma_4088::find_many_not_cond_no_filter` — NOT condition with no filters returns all items (prisma/4088) [connectors: all]
- [ ] `queries::regressions::prisma_4088::find_many_not_cond_one_filter` — NOT condition with one filter applies only that filter (prisma/4088) [connectors: all]
- [ ] `queries::regressions::prisma_4088::find_many_not_cond_two_filters` — NOT condition with one undefined filter applies only the defined one (prisma/4088) [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/regressions/prisma_4146.rs
- [ ] `queries::regressions::prisma_4146::update_list_fields_connect_bound` — updating over a connect bound bumps @updatedAt on the connected token (prisma/4146) [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/regressions/prisma_5941.rs
- [ ] `queries::regressions::prisma_5941::input_dates_no_nulls` — batched findUnique with compound date unique does not return nulls (prisma/5941) [connectors: caps:anyid]
- [ ] `queries::regressions::prisma_5941::input_dates_no_nulls_find_different_uniques` — batched findUnique with different date uniques returns each matching record (prisma/5941) [connectors: caps:anyid]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/regressions/prisma_8389.rs
- [ ] `queries::regressions::prisma_8389::find_many_more_than_101_should_work` — Mongo driver internal pagination fetches more than one 101-doc batch (prisma/8389) [connectors: only:mongo]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/regressions/prisma_933.rs
- [ ] `queries::regressions::prisma_933::prisma_933` — nested m2m read Buyer->sales->buyers returns expected shape (prisma-client-js/933) [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/relations/duplicate_col_regression.rs
- [ ] `queries::relations::duplicate_col_regression::test_1` — querying a scalar field that backs a relation field requests the column only once [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/relations/inline_relation.rs
- [ ] `queries::relations::inline_relation::scalar_field_back_relation` — querying the scalar field backing a relation and the relation itself both work [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/relations/related_null_queries.rs
- [ ] `queries::relations::related_null_queries::single_field_1n_rel_with_nulls` — single-field 1:n relation ignores related records connected with null [connectors: all]
- [ ] `queries::relations::related_null_queries::multi_field_1n_rel_with_nulls` — multi-field 1:n relation ignores related records with any null relation field [connectors: all]
- [ ] `queries::relations::related_null_queries::single_field_1_1_rel_inline_child` — single-field 1:1 relation inlined on child with null finds no related record [connectors: all]
- [ ] `queries::relations::related_null_queries::single_field_1_1_rel_inline_parent` — single-field 1:1 relation inlined on parent with null finds no related record [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/relations/unnecessary_db_reqs.rs
- [ ] `queries::relations::unnecessary_db_reqs::one2m_no_roundtrips` — one-to-many relations do not create unnecessary roundtrips (empty query, WIP port) [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/relations/views.rs
- [ ] `queries::relations::views::nested_read` — findMany on a view with nested read of related children [connectors: exclude:mongo,mysql,vitess,sqlite]
- [ ] `queries::relations::views::filtered_read` — findMany on a view filtered by a relation predicate on children [connectors: exclude:mongo,mysql,vitess,sqlite]
- [ ] `queries::relations::views::sorted_read` — findMany on a view ordered by related children _count [connectors: exclude:mongo,mysql,vitess,sqlite]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/simple/composite_default_value.rs
- [ ] `queries::simple::composite_default_value::missing_required_fields_are_backfilled` — missing required composite fields are backfilled with their defaults [connectors: only:mongo]
- [ ] `queries::simple::composite_default_value::opt_fields_are_not_backfilled` — optional composite fields are not backfilled and stay null [connectors: only:mongo]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/simple/find_first.rs
- [ ] `queries::simple::find_first::find_first_matching` — findFirst with various where/orderBy/cursor/take/skip combinations [connectors: all]
- [ ] `queries::simple::find_first::find_first_not_matching` — findFirst returns null when nothing matches [connectors: all]
- [ ] `queries::simple::find_first::find_first_with_invalid_take_value` — findFirst errors 2019 when take is not 1 or -1 [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/simple/find_first_or_throw.rs
- [ ] `queries::simple::find_first_or_throw::find_first_or_throw_matching` — findFirstOrThrow returns the matching record for various where/orderBy/cursor [connectors: all]
- [ ] `queries::simple::find_first_or_throw::find_first_or_throw_not_matching` — findFirstOrThrow errors 2025 when nothing matches [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/simple/find_many.rs
- [ ] `queries::simple::find_many::return_empty` — findMany returns an empty list when there is no data [connectors: all]
- [ ] `queries::simple::find_many::return_all` — findMany returns all records [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/simple/find_unique.rs
- [ ] `queries::simple::find_unique::find_unique_by_id` — findUnique by id [connectors: all]
- [ ] `queries::simple::find_unique::find_unique_by_single_unique` — findUnique by single unique field (email) [connectors: all]
- [ ] `queries::simple::find_unique::find_unique_by_multi_unique` — findUnique by compound unique (first_name_last_name) [connectors: all]
- [ ] `queries::simple::find_unique::no_result_find_unique_by_id` — findUnique by id returns null when not found [connectors: all]
- [ ] `queries::simple::find_unique::no_result_find_unique_by_single_unique` — findUnique by single unique returns null when not found [connectors: all]
- [ ] `queries::simple::find_unique::no_result_find_unique_by_multi_unique` — findUnique by compound unique returns null when not found [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/simple/find_unique_or_throw.rs
- [ ] `queries::simple::find_unique_or_throw::find_unique_or_throw_when_record_is_found` — findUniqueOrThrow returns the record for email, compound unique, and id [connectors: all]
- [ ] `queries::simple::find_unique_or_throw::no_result_find_unique_by_id` — findUniqueOrThrow by id errors 2025 when not found [connectors: all]
- [ ] `queries::simple::find_unique_or_throw::no_result_find_unique_by_single_unique` — findUniqueOrThrow by single unique errors 2025 when not found [connectors: all]
- [ ] `queries::simple::find_unique_or_throw::no_result_find_unique_by_multi_unique` — findUniqueOrThrow by compound unique errors 2025 when not found [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/simple/json_result.rs
- [ ] `queries::simple::json_result::test_when_distinct_result_is_json` — findFirst with distinct on a Json field returns the json value [connectors: exclude:mysql caps:json]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/simple/m2m.rs
- [ ] `queries::simple::m2m::fetch_only_associated` — m2m query fetches only the associated categories/posts [connectors: all]
- [ ] `queries::simple::m2m::filtering_ordering` — nested m2m relation with where filter and orderBy [connectors: all]
- [ ] `queries::simple::m2m::basic_pagination` — nested m2m relation pagination with take/skip/orderBy [connectors: all]
- [ ] `queries::simple::m2m::m2m_sharing_same_row` — m2m where the two sides share the same join-row column types [connectors: all]
- [ ] `queries::simple::m2m::repro_16390` — deleted item not returned via m2m join relationLoadStrategy (prisma/16390) [connectors: only:postgres]
- [ ] `queries::simple::m2m::repro_28304` — m2m with very long model names within alias character limit (prisma/28304) [connectors: only:postgres]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/simple/mongo_incorrect_fields.rs
- [ ] `queries::simple::mongo_incorrect_fields::correct_error_for_missing_field` — findMany errors 2032 when a required field is missing in the document [connectors: only:mongo]
- [ ] `queries::simple::mongo_incorrect_fields::correct_error_for_type_mismatch` — findMany errors 2023 when a field has a type mismatch (Int vs String) [connectors: only:mongo]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/simple/multi_field_unique.rs
- [ ] `queries::simple::multi_field_unique::simple` — findUnique by two-field compound unique [connectors: all]
- [ ] `queries::simple::multi_field_unique::non_existant_user` — findUnique by compound unique returns null when not found [connectors: all]
- [ ] `queries::simple::multi_field_unique::incomplete_where` — findUnique errors 2012 when compound unique where is incomplete [connectors: all]
- [ ] `queries::simple::multi_field_unique::aliased_index` — findUnique by aliased (named) compound unique [connectors: all]
- [ ] `queries::simple::multi_field_unique::ludicrous_fields` — findUnique by a 26-field compound unique [connectors: exclude:mysql,vitess]
- [ ] `queries::simple::multi_field_unique::single_field_multi_unique` — findUnique by a single-field @@unique index [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/simple/one2m.rs
- [ ] `queries::simple::one2m::simple` — findMany parent with nested children read [connectors: all]
- [ ] `queries::simple::one2m::vanilla` — findMany parent with two levels of nested children read [connectors: all]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/simple/raw_mongo.rs
- [ ] `queries::simple::raw_mongo::execute_raw` — runCommandRaw insert then update, verified by findMany [connectors: only:mongo]
- [ ] `queries::simple::raw_mongo::raw_find` — findTestModelRaw validation and behaviour with query/options combinations [connectors: only:mongo]
- [ ] `queries::simple::raw_mongo::raw_aggregate` — aggregateTestModelRaw validation and behaviour with pipeline/options combinations [connectors: only:mongo]
- [ ] `queries::simple::raw_mongo::raw_find_and_modify` — runCommandRaw findAndModify requires remove or update and returns the modified doc [connectors: only:mongo]
- [ ] `queries::simple::raw_mongo::raw_update` — runCommandRaw update result omits cluster/optime keys [connectors: only:mongo]
- [ ] `queries::simple::raw_mongo::raw_batching` — batched runCommandRaw inserts return per-command results [connectors: only:mongo]
- [ ] `queries::simple::raw_mongo::find_aggregate_raw_mapped_model` — findRaw and aggregateRaw work with @@map-ped models [connectors: only:mongo]

### query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/views.rs
- [ ] `queries::views::simple_read` — findMany on view returns computed fullName [connectors: exclude:mongo,mysql,vitess,sqlite]
- [ ] `queries::views::filtered_read` — filter view by column and by computed column [connectors: exclude:mongo,mysql,vitess,sqlite]
- [ ] `queries::views::sorted_read` — order view by computed column [connectors: exclude:mongo,mysql,vitess,sqlite]
- [ ] `queries::views::no_cursor` — cursor unsupported on view without unique errors 2009 [connectors: exclude:mongo,mysql,vitess,sqlite]
- [ ] `queries::views::cursor` — cursor works on view with unique [connectors: exclude:mongo,mysql,vitess,sqlite]
- [ ] `queries::views::no_find_unique` — findUnique not available on view without unique [connectors: exclude:mongo,mysql,vitess,sqlite]
- [ ] `queries::views::find_unique` — findUnique on view with unique [connectors: exclude:mongo,mysql,vitess,sqlite]
- [ ] `queries::views::no_find_unique_or_throw` — findUniqueOrThrow not available on view without unique [connectors: exclude:mongo,mysql,vitess,sqlite]
- [ ] `queries::views::find_unique_or_throw` — findUniqueOrThrow on view with unique [connectors: exclude:mongo,mysql,vitess,sqlite]
- [ ] `queries::views::take_with_order_by` — take with orderBy on view [connectors: exclude:mongo,mysql,vitess,sqlite]
- [ ] `queries::views::take_without_order_by` — take without orderBy errors 2012 [connectors: exclude:mongo,mysql,vitess,sqlite]
- [ ] `queries::views::take_without_order_by_with_unique` — take without orderBy on view with unique [connectors: exclude:mongo,mysql,vitess,sqlite]
- [ ] `queries::views::skip_with_order_by` — skip with orderBy on view [connectors: exclude:mongo,mysql,vitess,sqlite]
- [ ] `queries::views::skip_without_order_by` — skip without orderBy errors 2012 [connectors: exclude:mongo,mysql,vitess,sqlite]
- [ ] `queries::views::skip_without_order_by_with_unique` — skip without orderBy on view with unique [connectors: exclude:mongo,mysql,vitess,sqlite]
- [ ] `queries::views::take_skip_with_order_by` — take and skip with orderBy on view [connectors: exclude:mongo,mysql,vitess,sqlite]
- [ ] `queries::views::take_skip_without_order_by` — take and skip without orderBy errors 2012 [connectors: exclude:mongo,mysql,vitess,sqlite]
- [ ] `queries::views::take_skip_without_order_by_with_unique` — take and skip without orderBy on view with unique [connectors: exclude:mongo,mysql,vitess,sqlite]
- [ ] `queries::views::take_with_empty_order_by` — take with empty orderBy errors 2019 [connectors: exclude:mongo,mysql,vitess,sqlite]
- [ ] `queries::views::take_with_empty_order_by_with_unique` — take with empty orderBy on view with unique [connectors: exclude:mongo,mysql,vitess,sqlite]
- [ ] `queries::views::skip_with_empty_order_by` — skip with empty orderBy errors 2019 [connectors: exclude:mongo,mysql,vitess,sqlite]
- [ ] `queries::views::skip_with_empty_order_by_with_unique` — skip with empty orderBy on view with unique [connectors: exclude:mongo,mysql,vitess,sqlite]
- [ ] `queries::views::group_by_take_with_order_by` — groupBy take with orderBy on view [connectors: exclude:mongo,mysql,vitess,sqlite]
- [ ] `queries::views::group_by_take_without_order_by` — groupBy take without orderBy errors 2012 [connectors: exclude:mongo,mysql,vitess,sqlite]
- [ ] `queries::views::group_by_take_without_order_by_with_unique` — groupBy take without orderBy on view with unique [connectors: exclude:mongo,mysql,vitess,sqlite]
- [ ] `queries::views::group_by_take_with_empty_order_by` — groupBy take with empty orderBy errors 2019 [connectors: exclude:mongo,mysql,vitess,sqlite]
- [ ] `queries::views::group_by_take_with_empty_order_by_with_unique` — groupBy take with empty orderBy on view with unique [connectors: exclude:mongo,mysql,vitess,sqlite]
- [ ] `queries::views::group_by_skip_with_order_by` — groupBy skip with orderBy on view [connectors: exclude:mongo,mysql,vitess,sqlite]
- [ ] `queries::views::group_by_skip_without_order_by` — groupBy skip without orderBy errors 2012 [connectors: exclude:mongo,mysql,vitess,sqlite]
- [ ] `queries::views::group_by_skip_without_order_by_with_unique` — groupBy skip without orderBy on view with unique [connectors: exclude:mongo,mysql,vitess,sqlite]
- [ ] `queries::views::group_by_skip_with_empty_order_by` — groupBy skip with empty orderBy errors 2019 [connectors: exclude:mongo,mysql,vitess,sqlite]
- [ ] `queries::views::group_by_skip_with_empty_order_by_with_unique` — groupBy skip with empty orderBy on view with unique [connectors: exclude:mongo,mysql,vitess,sqlite]

**Total: 873 tests**
