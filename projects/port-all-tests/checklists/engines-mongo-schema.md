# Checklist — prisma-engines mongodb-schema-connector tests

Source: prisma/prisma-engines@e922089b7d7502aff4249d5da3420f6fa55fc6ad — schema-engine/connectors/mongodb-schema-connector/tests/**

Protocol: each line is one source test. `[ ]` = not yet dispositioned. The Opus reviewer sub-agent checks `[x]` ONLY when satisfied that the test is (a) faithfully ported and passing, (b) faithfully ported as `test.fails` with a `failing.md` entry, or (c) covered by a justified individual `non-ported.md` entry. Implementer sub-agents never check boxes.

### schema-engine/connectors/mongodb-schema-connector/tests/introspection/basic/mod.rs

- [ ] `introspection::basic::empty_collection` — Empty collection introspects to model with only default ObjectId id [connectors: mongodb]
- [ ] `introspection::basic::integer_id` — Document with integer _id introspects id as Int [connectors: mongodb]
- [ ] `introspection::basic::multiple_collections_with_data` — Two collections with data become two separate models [connectors: mongodb]
- [ ] `introspection::basic::collection_with_json_schema` — Collection with JSON Schema validator emits warning and doc comment [connectors: mongodb]
- [ ] `introspection::basic::capped_collection` — Capped collection emits unsupported warning and doc comment [connectors: mongodb]

### schema-engine/connectors/mongodb-schema-connector/tests/introspection/dirty_data/mod.rs

- [ ] `introspection::dirty_data::explicit_id_field` — Field literally named "id" is remapped to id_ alongside _id [connectors: mongodb]
- [ ] `introspection::dirty_data::mixed_id_types` — Mixed _id types introspect id as Json with sampling comment [connectors: mongodb]
- [ ] `introspection::dirty_data::mixing_types` — Field with String and Int values becomes Json with warning [connectors: mongodb]
- [ ] `introspection::dirty_data::mixing_types_with_the_same_base_type` — Timestamp and Date values merge into DateTime with warning [connectors: mongodb]

### schema-engine/connectors/mongodb-schema-connector/tests/introspection/index/mod.rs

- [ ] `introspection::index::single_column_normal_index` — Ascending single-column index introspects to @@index with mapped name. [connectors: mongodb]
- [ ] `introspection::index::single_column_composite_index` — Index on nested composite field introspects to @@index with dotted path. [connectors: mongodb]
- [ ] `introspection::index::single_column_composite_array_index` — Index on array composite field introspects to @@index on list type. [connectors: mongodb]
- [ ] `introspection::index::single_column_deep_composite_index` — Index on deeply nested composite field introspects to dotted @@index. [connectors: mongodb]
- [ ] `introspection::index::single_column_descending_index` — Descending single-column index introspects to @@index with sort Desc. [connectors: mongodb]
- [ ] `introspection::index::single_column_descending_composite_index` — Descending composite-field index introspects to @@index with sort Desc. [connectors: mongodb]
- [ ] `introspection::index::single_column_fulltext_index` — Text index on single field introspects to @@fulltext. [connectors: mongodb]
- [ ] `introspection::index::single_column_fulltext_composite_index` — Text index on composite field introspects to @@fulltext with dotted path. [connectors: mongodb]
- [ ] `introspection::index::single_array_column_fulltext_composite_index` — Text index on array composite field introspects to @@fulltext. [connectors: mongodb]
- [ ] `introspection::index::multi_column_fulltext_index` — Multi-field text index introspects to single @@fulltext. [connectors: mongodb]
- [ ] `introspection::index::multi_column_fulltext_composite_index` — Multi composite-field text index introspects to @@fulltext. [connectors: mongodb]
- [ ] `introspection::index::multi_column_fulltext_index_with_desc_in_end` — Text index with trailing descending field introspects to @@fulltext with sort. [connectors: mongodb]
- [ ] `introspection::index::multi_column_fulltext_composite_index_with_desc_in_end` — Composite text index with trailing descending field introspects to @@fulltext. [connectors: mongodb]
- [ ] `introspection::index::multi_column_fulltext_index_with_desc_in_beginning` — Text index with leading descending field introspects to @@fulltext with sort. [connectors: mongodb]
- [ ] `introspection::index::multi_column_fulltext_composite_index_with_desc_in_beginning` — Composite text index with leading descending field introspects to @@fulltext. [connectors: mongodb]
- [ ] `introspection::index::multi_column_fulltext_index_with_asc_in_end` — Text index with trailing ascending field introspects to @@fulltext with sort. [connectors: mongodb]
- [ ] `introspection::index::multi_column_fulltext_index_with_asc_in_beginning` — Text index with leading ascending field introspects to @@fulltext with sort. [connectors: mongodb]
- [ ] `introspection::index::multi_column_fulltext_index_with_asc_in_beginning_desc_in_end` — Text index with leading asc, trailing desc introspects to named @@fulltext. [connectors: mongodb]
- [ ] `introspection::index::fultext_index` — Text index introspects to @@fulltext under infinite composite depth. [connectors: mongodb]
- [ ] `introspection::index::fultext_composite_index` — Composite text index introspects to @@fulltext under infinite depth. [connectors: mongodb]
- [ ] `introspection::index::index_pointing_to_a_renamed_field` — Index on underscore-prefixed field introspects with @map and renamed @@index. [connectors: mongodb]
- [ ] `introspection::index::composite_index_pointing_to_a_renamed_field` — Composite index on renamed nested field introspects with @map and @@index. [connectors: mongodb]
- [ ] `introspection::index::single_column_normal_index_default_name` — Index with default Prisma name introspects to @@index without map. [connectors: mongodb]
- [ ] `introspection::index::single_column_normal_composite_index_default_name` — Composite index with default name introspects to @@index without map. [connectors: mongodb]
- [ ] `introspection::index::multi_column_normal_index` — Compound ascending/descending index introspects to @@index with sort order. [connectors: mongodb]
- [ ] `introspection::index::single_column_unique_index` — Unique single-column index introspects to field @unique. [connectors: mongodb]
- [ ] `introspection::index::single_column_unique_composite_index` — Unique composite-field index introspects to @@unique with dotted path. [connectors: mongodb]
- [ ] `introspection::index::single_array_column_unique_composite_index` — Unique array composite-field index introspects to @@unique on list type. [connectors: mongodb]
- [ ] `introspection::index::single_column_unique_index_default_name` — Unique index with default name introspects to @unique without map. [connectors: mongodb]
- [ ] `introspection::index::single_column_unique_composite_index_default_name` — Unique composite index with default name introspects to @@unique without map. [connectors: mongodb]
- [ ] `introspection::index::multi_column_unique_index` — Compound unique index introspects to @@unique with sort order. [connectors: mongodb]
- [ ] `introspection::index::multi_column_unique_composite_index` — Compound unique index mixing composite field introspects to @@unique. [connectors: mongodb]
- [ ] `introspection::index::unsupported_types_in_a_unique_index` — Unique index on unsupported-type field introspects to @unique with Unsupported. [connectors: mongodb]
- [ ] `introspection::index::unsupported_types_in_an_index` — Index on unsupported-type field introspects to @@index and warns. [connectors: mongodb]
- [ ] `introspection::index::partial_indices_should_be_ignored` — Partial-filter index is ignored, producing no @@index. [connectors: mongodb]
- [ ] `introspection::index::partial_composite_indices_should_be_ignored` — Partial composite-filter index is ignored, producing no @@index. [connectors: mongodb]
- [ ] `introspection::index::index_pointing_to_non_existing_field_should_add_the_field` — Index on absent field adds Json? field and warns. [connectors: mongodb]
- [ ] `introspection::index::index_pointing_to_non_existing_composite_field_should_add_the_field_and_type` — Index on absent composite field adds nullable type/field and warns. [connectors: mongodb]
- [ ] `introspection::index::deep_index_pointing_to_non_existing_composite_field_should_add_the_field_and_type` — Index on absent deep composite path adds nested types/fields and warns. [connectors: mongodb]
- [ ] `introspection::index::index_pointing_to_mapped_non_existing_field_should_add_the_mapped_field` — Index on absent mapped field adds @map Json? field and warns. [connectors: mongodb]
- [ ] `introspection::index::composite_index_pointing_to_mapped_non_existing_field_should_add_the_mapped_field` — Composite index on absent mapped field adds mapped nested field and warns. [connectors: mongodb]
- [ ] `introspection::index::compound_index_pointing_to_non_existing_field_should_add_the_field` — Compound index on absent fields adds Json? fields and warns. [connectors: mongodb]
- [ ] `introspection::index::composite_index_with_one_existing_field_should_add_missing_stuff_only` — Composite index adds only the missing nested field, keeping existing. [connectors: mongodb]
- [ ] `introspection::index::deep_composite_index_with_one_existing_field_should_add_missing_stuff_only` — Deep composite index adds only missing nested type/field, keeping existing. [connectors: mongodb]
- [ ] `introspection::index::deep_composite_index_with_one_existing_field_should_add_missing_stuff_only_2` — Deep composite index adds only missing leaf field under existing type. [connectors: mongodb]
- [ ] `introspection::index::deep_composite_index_should_add_missing_stuff_in_different_layers` — Deep composite index adds missing fields across multiple nested layers. [connectors: mongodb]
- [ ] `introspection::index::compound_index_with_one_existing_field_pointing_to_non_existing_field_should_add_the_field` — Compound index adds only the missing field, keeping existing typed field. [connectors: mongodb]
- [ ] `introspection::index::unique_index_pointing_to_non_existing_field_should_add_the_field` — Unique index on absent field adds Json? @unique field and warns. [connectors: mongodb]
- [ ] `introspection::index::fulltext_index_pointing_to_non_existing_field_should_add_the_field` — Fulltext index on absent field adds Json? field and warns. [connectors: mongodb]
- [ ] `introspection::index::composite_type_index_without_corresponding_data_should_not_crash` — Indexes on data-less composite paths add types without crashing. [connectors: mongodb]
- [ ] `introspection::index::composite_type_index_with_non_composite_fields_in_the_middle_should_not_crash` — Index through non-composite middle field introspects without crashing. [connectors: mongodb]

### schema-engine/connectors/mongodb-schema-connector/tests/introspection/model_renames/mod.rs

- [ ] `introspection::model_renames::a_model_with_reserved_name` — Collection named PrismaClient renamed with @@map and comment [connectors: mongodb]
- [ ] `introspection::model_renames::reserved_names_case_sensitivity` — Lowercase near-reserved name kept unchanged, not renamed [connectors: mongodb]

### schema-engine/connectors/mongodb-schema-connector/tests/introspection/multi_file/mod.rs

- [ ] `introspection::multi_file::reintrospect_new_model_single_file` — New model added into single existing file [connectors: mongodb]
- [ ] `introspection::multi_file::reintrospect_new_model_multi_file` — New model routed to introspected.prisma across multiple files [connectors: mongodb]
- [ ] `introspection::multi_file::reintrospect_removed_model_single_file` — Model absent from database removed from single file [connectors: mongodb]
- [ ] `introspection::multi_file::reintrospect_removed_model_multi_file` — Model absent from database removed, emptying its file [connectors: mongodb]
- [ ] `introspection::multi_file::reintrospect_new_composite_single_file` — New composite type and model added into single file [connectors: mongodb]
- [ ] `introspection::multi_file::reintrospect_new_composite_multi_file` — New composite and model routed to introspected.prisma [connectors: mongodb]
- [ ] `introspection::multi_file::reintrospect_composite_model_single_file` — Absent composite model removed from single file [connectors: mongodb]
- [ ] `introspection::multi_file::reintrospect_removed_composite_multi_file` — Absent composite model removed, emptying its file [connectors: mongodb]
- [ ] `introspection::multi_file::reintrospect_with_existing_composite_type` — Existing shared composite type renamed per-model into introspected.prisma [connectors: mongodb]
- [ ] `introspection::multi_file::reintrospect_keep_configuration_when_spread_across_files` — Datasource and generator blocks kept in their original files [connectors: mongodb]
- [ ] `introspection::multi_file::reintrospect_keep_configuration_when_no_models` — Configuration-only file preserved when it has no models [connectors: mongodb]
- [ ] `introspection::multi_file::reintrospect_empty_multi_file` — Empty database preserves datasource and generator config files [connectors: mongodb]

### schema-engine/connectors/mongodb-schema-connector/tests/introspection/remapping_names/mod.rs

- [ ] `introspection::remapping_names::remapping_fields_with_invalid_characters` — Fields with invalid characters get sanitized names via @map [connectors: mongodb]
- [ ] `introspection::remapping_names::remapping_models_with_invalid_characters` — Collections with invalid characters get sanitized names via @@map [connectors: mongodb]
- [ ] `introspection::remapping_names::remapping_composite_fields_with_numbers` — Numeric composite field commented out with invalid-name warning [connectors: mongodb]
- [ ] `introspection::remapping_names::remapping_model_fields_with_numbers` — Numeric model field commented out with invalid-name warning [connectors: mongodb]
- [ ] `introspection::remapping_names::remapping_model_fields_with_numbers_dirty` — Numeric mixed-type field commented out as Json with warnings [connectors: mongodb]

### schema-engine/connectors/mongodb-schema-connector/tests/introspection/types/composite.rs

- [ ] `introspection::types::composite::singular` — Nested object becomes composite type with merged optional fields [connectors: mongodb]
- [ ] `introspection::types::composite::dirty_data` — Composite field with mixed types becomes Json with warning [connectors: mongodb]
- [ ] `introspection::types::composite::array` — Array of objects becomes composite type array field [connectors: mongodb]
- [ ] `introspection::types::composite::deep_array` — Nested array of arrays introspects as Json [connectors: mongodb]
- [ ] `introspection::types::composite::nullability` — Sometimes-null nested objects yield optional composite types [connectors: mongodb]
- [ ] `introspection::types::composite::unsupported` — JavaScriptCode inside composite maps to Unsupported type [connectors: mongodb]
- [ ] `introspection::types::composite::underscores_in_names` — Underscored field name preserved in composite type generation [connectors: mongodb]
- [ ] `introspection::types::composite::depth_none` — Depth None flattens nested object to Json [connectors: mongodb]
- [ ] `introspection::types::composite::depth_none_level_1_array` — Depth None flattens nested object array to Json[] [connectors: mongodb]
- [ ] `introspection::types::composite::depth_1_level_1` — Depth 1 introspects single-level nested object as composite [connectors: mongodb]
- [ ] `introspection::types::composite::depth_1_level_2` — Depth 1 introspects level one, deeper nesting as Json [connectors: mongodb]
- [ ] `introspection::types::composite::depth_1_level_2_array` — Depth 1 introspects composite array, deeper array as Json[] [connectors: mongodb]
- [ ] `introspection::types::composite::depth_2_level_2_array` — Depth 2 introspects two nested composite type levels [connectors: mongodb]
- [ ] `introspection::types::composite::name_clashes` — Composite type clashing with model name suffixed underscore [connectors: mongodb]
- [ ] `introspection::types::composite::non_id_object_ids` — Non-id ObjectId fields typed String @db.ObjectId in composites [connectors: mongodb]
- [ ] `introspection::types::composite::fields_named_id_in_composite` — Fields named id/_id in composites remapped via @map [connectors: mongodb]
- [ ] `introspection::types::composite::do_not_create_empty_types` — Empty nested object becomes Json with no-data warning [connectors: mongodb]
- [ ] `introspection::types::composite::do_not_spam_empty_type_warnings` — Repeated empty nested objects emit single no-data warning [connectors: mongodb]
- [ ] `introspection::types::composite::do_not_create_empty_types_in_types` — Empty nested object inside composite becomes Json with warning [connectors: mongodb]
- [ ] `introspection::types::composite::no_empty_type_warnings_when_depth_is_reached` — Depth None suppresses empty-type warnings for nested objects [connectors: mongodb]
- [ ] `introspection::types::composite::kanji` — Non-ASCII composite field name remapped via @map [connectors: mongodb]

### schema-engine/connectors/mongodb-schema-connector/tests/introspection/types/mod.rs

- [ ] `introspection::types::string` — String fields introspect as String with optional nullability [connectors: mongodb]
- [ ] `introspection::types::double` — Double fields introspect as Float with nullability [connectors: mongodb]
- [ ] `introspection::types::bool` — Boolean fields introspect as Boolean with nullability [connectors: mongodb]
- [ ] `introspection::types::int` — Int32 fields introspect as Int with nullability [connectors: mongodb]
- [ ] `introspection::types::bigint` — Int64 fields introspect as BigInt with nullability [connectors: mongodb]
- [ ] `introspection::types::timestamp` — Timestamp fields introspect as DateTime with nullability [connectors: mongodb]
- [ ] `introspection::types::binary` — Binary fields introspect as Bytes with nullability [connectors: mongodb]
- [ ] `introspection::types::object_id` — ObjectId fields introspect as String @db.ObjectId [connectors: mongodb]
- [ ] `introspection::types::date` — DateTime fields introspect as DateTime @db.Date [connectors: mongodb]
- [ ] `introspection::types::decimal` — Decimal128 fields introspect as Unsupported("Decimal128") [connectors: mongodb]
- [ ] `introspection::types::array` — Arrays of ints introspect as Int[] list fields [connectors: mongodb]
- [ ] `introspection::types::deep_array` — Nested array of arrays introspects as Json [connectors: mongodb]
- [ ] `introspection::types::empty_arrays` — Empty-only array field becomes Json? with undetermined-type warning [connectors: mongodb]
- [ ] `introspection::types::unknown_types` — Null-only field becomes Json? with undetermined-type warning [connectors: mongodb]

### schema-engine/connectors/mongodb-schema-connector/tests/introspection/views/mod.rs

- [ ] `introspection::views::collection_with_view` — Mongo view is ignored; only backing collection becomes model [connectors: mongodb]

### schema-engine/connectors/mongodb-schema-connector/tests/migrations/scenarios/

- [ ] `schema-engine/connectors/mongodb-schema-connector/tests/migrations/scenarios/composite_indexes_can_be_changed_from_descending_to_ascending/` — db push changes a composite (nested-field) index sort order from descending to ascending [connectors: mongodb]
- [ ] `schema-engine/connectors/mongodb-schema-connector/tests/migrations/scenarios/composite_indexes_can_be_created/` — db push creates a composite index on a nested embedded-document field [connectors: mongodb]
- [ ] `schema-engine/connectors/mongodb-schema-connector/tests/migrations/scenarios/composite_indexes_can_be_created_descending/` — db push creates a descending composite index on a nested embedded-document field [connectors: mongodb]
- [ ] `schema-engine/connectors/mongodb-schema-connector/tests/migrations/scenarios/composite_indexes_can_be_dropped/` — db push drops a composite index on a nested embedded-document field [connectors: mongodb]
- [ ] `schema-engine/connectors/mongodb-schema-connector/tests/migrations/scenarios/composite_indexes_can_be_renamed/` — db push renames a composite index via the map argument [connectors: mongodb]
- [ ] `schema-engine/connectors/mongodb-schema-connector/tests/migrations/scenarios/composite_indexes_work_on_arrays/` — db push creates unique, index, and fulltext composite indexes over array embedded fields [connectors: mongodb]
- [ ] `schema-engine/connectors/mongodb-schema-connector/tests/migrations/scenarios/index_keys_can_be_changed/` — db push changes an index's key columns [connectors: mongodb]
- [ ] `schema-engine/connectors/mongodb-schema-connector/tests/migrations/scenarios/index_sort_order_doesnt_count_without_preview_feature/` — db push ignores index sort order without the extendedIndexes preview feature [connectors: mongodb]
- [ ] `schema-engine/connectors/mongodb-schema-connector/tests/migrations/scenarios/index_to_unique/` — db push converts an existing index into a unique constraint [connectors: mongodb]
- [ ] `schema-engine/connectors/mongodb-schema-connector/tests/migrations/scenarios/indexes_can_be_changed_from_descending_to_ascending/` — db push changes an index sort order from descending to ascending [connectors: mongodb]
- [ ] `schema-engine/connectors/mongodb-schema-connector/tests/migrations/scenarios/indexes_can_be_created/` — db push creates multi-column and single-column indexes on User and Post [connectors: mongodb]
- [ ] `schema-engine/connectors/mongodb-schema-connector/tests/migrations/scenarios/indexes_can_be_created_descending/` — db push creates indexes with descending sort order on columns [connectors: mongodb]
- [ ] `schema-engine/connectors/mongodb-schema-connector/tests/migrations/scenarios/indexes_can_be_dropped/` — db push drops indexes not present in the schema [connectors: mongodb]
- [ ] `schema-engine/connectors/mongodb-schema-connector/tests/migrations/scenarios/indexes_can_be_renamed/` — db push renames existing indexes to match the schema map names [connectors: mongodb]
- [ ] `schema-engine/connectors/mongodb-schema-connector/tests/migrations/scenarios/indexes_on_nested_fields_get_dropped/` — db push drops pre-existing indexes on nested (multikey) fields [connectors: mongodb]
- [ ] `schema-engine/connectors/mongodb-schema-connector/tests/migrations/scenarios/map_annotations/` — db push applies map annotations on indexes with nested embedded fields [connectors: mongodb]
- [ ] `schema-engine/connectors/mongodb-schema-connector/tests/migrations/scenarios/multi_column_fulltext_indexes_can_be_created/` — db push creates a multi-column fulltext index [connectors: mongodb]
- [ ] `schema-engine/connectors/mongodb-schema-connector/tests/migrations/scenarios/multi_column_mixed_fulltext_indexes_can_be_changed/` — db push changes a mixed multi-column fulltext index with sort order [connectors: mongodb]
- [ ] `schema-engine/connectors/mongodb-schema-connector/tests/migrations/scenarios/multi_column_mixed_fulltext_indexes_can_be_created/` — db push creates a mixed multi-column fulltext index with sort order [connectors: mongodb]
- [ ] `schema-engine/connectors/mongodb-schema-connector/tests/migrations/scenarios/single_column_fulltext_indexes_can_be_created/` — db push creates a single-column fulltext index [connectors: mongodb]
- [ ] `schema-engine/connectors/mongodb-schema-connector/tests/migrations/scenarios/single_field_uniques_are_created/` — db push creates a single-field unique constraint [connectors: mongodb]
- [ ] `schema-engine/connectors/mongodb-schema-connector/tests/migrations/scenarios/unique_to_index/` — db push converts an existing unique constraint into a plain index [connectors: mongodb]

**Total: 137 tests**
