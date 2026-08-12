# Checklist — prisma-engines sql-introspection-tests

Source: prisma/prisma-engines@e922089b7d7502aff4249d5da3420f6fa55fc6ad — schema-engine/sql-introspection-tests/tests/**

Protocol: each line is one source test. `[ ]` = not yet dispositioned. The Opus reviewer sub-agent checks `[x]` ONLY when satisfied that the test is (a) faithfully ported and passing, (b) faithfully ported as `test.fails` with a `failing.md` entry, or (c) covered by a justified individual `non-ported.md` entry. Implementer sub-agents never check boxes.

### schema-engine/sql-introspection-tests/tests/cockroachdb/constraints.rs

- [ ] `cockroachdb::constraints::aragon_test_cockroachdb` — Introspects check constraint table on CockroachDB with unsupported-constraint warning. [connectors: tags(CockroachDb)]
- [ ] `cockroachdb::constraints::noalyss_folder_test_cockroachdb` — Introspects multiple CockroachDB check constraints and column comments with warnings. [connectors: tags(CockroachDb)]

### schema-engine/sql-introspection-tests/tests/cockroachdb/gin.rs

- [ ] `cockroachdb::gin::gin_unsupported_type` — Introspects GIN index on unsupported geometry column with Gin type attribute. [connectors: tags(CockroachDb) preview_features("cockroachDb")]
- [ ] `cockroachdb::gin::array_ops` — Introspects GIN index on integer array column with Gin type attribute. [connectors: tags(CockroachDb) preview_features("cockroachDb")]
- [ ] `cockroachdb::gin::jsonb_ops` — Introspects GIN index on jsonb column mapped to Json with Gin type. [connectors: tags(CockroachDb) preview_features("cockroachDb")]

### schema-engine/sql-introspection-tests/tests/cockroachdb/mod.rs

- [ ] `cockroachdb::introspecting_cockroach_db_with_postgres_provider_fails` — Fails introspecting CockroachDB when schema provider is postgresql, suggesting cockroachdb. [connectors: tags(CockroachDb)]
- [ ] `cockroachdb::rowid_introspects_to_autoincrement` — Introspects unique_rowid default into autoincrement on CockroachDB. [connectors: tags(CockroachDb)]
- [ ] `cockroachdb::identity_introspects_to_sequence_with_default_settings_v_22_1` — Introspects identity column into sequence default on CockroachDB 22.1. [connectors: tags(CockroachDb221)]
- [ ] `cockroachdb::identity_introspects_to_sequence_with_default_settings_v_22_2` — Introspects identity column into sequence with maxValue on CockroachDB 22.2. [connectors: tags(CockroachDb222)]
- [ ] `cockroachdb::identity_with_options_introspects_to_sequence_with_options` — Introspects identity column options into sequence with min, max, increment, start. [connectors: tags(CockroachDb)]
- [ ] `cockroachdb::dbgenerated_type_casts_should_work` — Introspects casted default into dbgenerated with CockroachDB STRING type cast. [connectors: tags(CockroachDb)]
- [ ] `cockroachdb::scalar_list_defaults_work_on_22_1` — Introspects scalar list array defaults on CockroachDB 22.1. [connectors: tags(CockroachDb221)]
- [ ] `cockroachdb::scalar_list_defaults_work_on_22_2` — Introspects scalar list array defaults on CockroachDB 22.2. [connectors: tags(CockroachDb222)]
- [ ] `cockroachdb::string_col_with_length` — Introspects sized STRING columns and relations into native db.String types. [connectors: tags(CockroachDb)]
- [ ] `cockroachdb::row_level_ttl_stopgap` — Introspects row-level TTL table emitting TTL stopgap warning and comment. [connectors: tags(CockroachDb)]
- [ ] `cockroachdb::commenting_stopgap` — Introspects CockroachDB table and column comments emitting comment warnings. [connectors: tags(CockroachDb) preview_features("views")]

### schema-engine/sql-introspection-tests/tests/commenting_out/cockroachdb.rs

- [ ] `commenting_out::cockroachdb::a_table_without_uniques_should_ignore` — Table without unique identifier is ignored, back-relation gets @ignore [connectors: tags(CockroachDb)]
- [ ] `commenting_out::cockroachdb::ignore_on_back_relation_field_if_pointing_to_ignored_model` — Back-relation field to ignored model gets @ignore [connectors: tags(CockroachDb)]
- [ ] `commenting_out::cockroachdb::unsupported_type_keeps_its_usages_cockroach` — Unsupported geometry/geography columns kept as Unsupported with warnings [connectors: tags(CockroachDb)]

### schema-engine/sql-introspection-tests/tests/commenting_out/mod.rs

- [ ] `commenting_out::a_table_without_uniques_should_ignore` — Table without unique identifier is ignored, back-relation gets @ignore [connectors: exclude(Mssql, Mysql, CockroachDb)]
- [ ] `commenting_out::a_table_without_required_uniques` — Table with only optional unique is ignored [connectors: exclude(Sqlite, Mysql)]
- [ ] `commenting_out::a_table_without_fully_required_compound_unique` — Table with partly-optional compound unique is ignored [connectors: exclude(CockroachDb)]
- [ ] `commenting_out::remapping_field_names_to_empty` — Invalid numeric field name is commented out during introspection [connectors: exclude(CockroachDb, Mysql, Mssql, Sqlite)]

### schema-engine/sql-introspection-tests/tests/commenting_out/mssql.rs

- [ ] `commenting_out::mssql::a_table_without_uniques_should_ignore` — Table without unique identifier is ignored, back-relation gets @ignore [connectors: tags(Mssql)]
- [ ] `commenting_out::mssql::remapping_field_names_to_empty` — Invalid numeric field name is commented out during introspection [connectors: tags(Mssql)]

### schema-engine/sql-introspection-tests/tests/commenting_out/mysql.rs

- [ ] `commenting_out::mysql::a_table_without_required_uniques` — Table with only optional unique is ignored [connectors: tags(Mysql)]
- [ ] `commenting_out::mysql::a_table_without_uniques_should_ignore` — Table without unique identifier is ignored, back-relation gets @ignore [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `commenting_out::mysql::remapping_field_names_to_empty_mysql` — Invalid numeric field name is commented out during introspection [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `commenting_out::mysql::partition_table_gets_comment` — Partition table gets doc comment and partition-not-supported warning [connectors: tags(Mysql) exclude(Vitess)]

### schema-engine/sql-introspection-tests/tests/commenting_out/postgres.rs

- [ ] `commenting_out::postgres::relations_between_ignored_models_should_not_have_field_level_ignores` — Relations between two ignored models omit field-level @ignore attributes [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `commenting_out::postgres::fields_we_cannot_sanitize_are_commented_out_and_warned` — Fields with unsanitizable invalid names get commented out plus warning [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `commenting_out::postgres::unsupported_type_keeps_its_usages` — Unsupported-type column stays in its id, unique, and index usages [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `commenting_out::postgres::a_table_with_only_an_unsupported_id` — Table with only unsupported-type id is ignored and warned [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `commenting_out::postgres::a_table_with_unsupported_types_in_a_relation` — Unsupported-type columns are kept when used in a relation [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `commenting_out::postgres::dbgenerated_in_unsupported` — Unsupported-type and computed defaults are emitted as dbgenerated [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `commenting_out::postgres::commenting_out_a_table_without_columns` — Table with no retrievable columns is commented out with warning [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `commenting_out::postgres::ignore_on_back_relation_field_if_pointing_to_ignored_model` — Back-relation field to ignored model gets @ignore [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `commenting_out::postgres::partition_table_gets_comment` — Partition table gets doc comment and partition-not-supported warning [connectors: tags(Postgres11, Postgres12, Postgres13, Postgres14, Postgres15, Postgres16) exclude(CockroachDb)]
- [ ] `commenting_out::postgres::partition_table_gets_postgres10` — Postgres10 partition table without valid unique is ignored and warned [connectors: tags(Postgres) exclude(Postgres9, CockroachDb)]
- [ ] `commenting_out::postgres::row_level_security_warning` — Row-level-security table gets doc comment and warning [connectors: tags(Postgres) exclude(CockroachDb, Postgres9)]

### schema-engine/sql-introspection-tests/tests/commenting_out/sqlite.rs

- [ ] `commenting_out::sqlite::a_table_without_required_uniques` — Table with only optional unique is ignored [connectors: tags(Sqlite)]
- [ ] `commenting_out::sqlite::ignore_on_model_with_only_optional_id` — Models with only optional id are ignored [connectors: tags(Sqlite)]
- [ ] `commenting_out::sqlite::field_with_empty_name` — Field with blank name is commented out as invalid [connectors: tags(Sqlite)]
- [ ] `commenting_out::sqlite::remapping_field_names_to_empty` — Invalid numeric field name is commented out during introspection [connectors: tags(Sqlite)]

### schema-engine/sql-introspection-tests/tests/enums/cockroachdb.rs

- [ ] `enums::cockroachdb::a_table_with_enums` — Multiple database enums are introspected into enum blocks [connectors: tags(CockroachDb) capabilities(Enums)]
- [ ] `enums::cockroachdb::a_table_with_an_enum_default_value_that_is_an_empty_string` — Empty-string enum default becomes EMPTY_ENUM_VALUE with @map [connectors: tags(CockroachDb) capabilities(Enums)]
- [ ] `enums::cockroachdb::a_table_enums_should_return_alphabetically_even_when_in_different_order` — Enum blocks are output alphabetically regardless of creation order [connectors: tags(CockroachDb) capabilities(Enums)]
- [ ] `enums::cockroachdb::a_table_with_enum_default_values` — Enum column default value is introspected [connectors: tags(CockroachDb) capabilities(Enums)]
- [ ] `enums::cockroachdb::a_table_enums_array` — Enum array column and its enum block are introspected [connectors: tags(CockroachDb) capabilities(Enums, ScalarLists)]
- [ ] `enums::cockroachdb::a_table_with_enum_default_values_that_look_like_booleans` — Boolean-looking enum default value is introspected literally [connectors: tags(CockroachDb) capabilities(Enums)]
- [ ] `enums::cockroachdb::an_enum_with_invalid_value_names_should_have_them_commented_out` — Enum variants with invalid names are commented out [connectors: tags(CockroachDb)]
- [ ] `enums::cockroachdb::enum_array_type` — Enum name starting with underscore is mapped, array column introspected [connectors: tags(CockroachDb)]

### schema-engine/sql-introspection-tests/tests/enums/mod.rs

- [ ] `enums::a_table_with_enums` — Multiple enums are introspected into enum blocks stably [connectors: exclude(CockroachDb, Sqlite) capabilities(Enums)]
- [ ] `enums::a_table_enums_should_return_alphabetically_even_when_in_different_order` — Enum blocks are output alphabetically regardless of creation order [connectors: exclude(CockroachDb, Sqlite) capabilities(Enums)]
- [ ] `enums::a_table_with_enum_default_values` — Enum column default value is introspected [connectors: exclude(CockroachDb, Sqlite) capabilities(Enums)]

### schema-engine/sql-introspection-tests/tests/enums/mysql.rs

- [ ] `enums::mysql::an_enum_with_invalid_value_names_should_have_them_commented_out` — Inline enum variants with invalid names are commented out [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `enums::mysql::a_table_with_an_enum_default_value_that_is_an_empty_string` — Empty-string enum default becomes EMPTY_ENUM_VALUE with @map [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `enums::mysql::a_table_with_enum_default_values_that_look_like_booleans` — Boolean-looking enum default value is introspected literally [connectors: tags(Mysql) exclude(Vitess)]

### schema-engine/sql-introspection-tests/tests/enums/postgres.rs

- [ ] `enums::postgres::enum_reintrospection_preserves_good_indentation` — Re-introspection preserves existing enum block indentation and @@map [connectors: tags(Postgres)]
- [ ] `enums::postgres::a_table_enums_array` — Enum array column and its enum block are introspected [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `enums::postgres::an_enum_with_invalid_value_names_should_have_them_commented_out` — Enum variants with invalid names are commented out [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `enums::postgres::a_table_with_an_enum_default_value_that_is_an_empty_string` — Empty-string enum default becomes EMPTY_ENUM_VALUE with @map [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `enums::postgres::a_table_with_enum_default_values_that_look_like_booleans` — Boolean-looking enum default value is introspected literally [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `enums::postgres::invalid_enum_variants_regression` — Invalid enum variants commented out with warnings [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `enums::postgres::a_variant_that_cannot_be_sanitized_triggers_dbgenerated_in_defaults` — Unsanitizable variant default falls back to dbgenerated [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `enums::postgres::a_mapped_variant_will_not_warn` — Sanitized-and-mapped enum variant produces no warning [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `enums::postgres::a_mapped_enum_will_not_warn` — Sanitized-and-mapped enum name produces no warning [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `enums::postgres::enum_array_type` — Enum name starting with underscore is mapped, array column introspected [connectors: tags(Postgres) exclude(CockroachDb)]

### schema-engine/sql-introspection-tests/tests/enums/sqlite.rs

- [ ] `enums::sqlite::an_enum_in_the_model_is_preserved_when_introspected` — Existing enum in schema is preserved through re-introspection [connectors: tags(Sqlite)]
- [ ] `enums::sqlite::an_enum_in_the_model_is_preserved_without_redundant_attributes_when_introspected` — Preserved enum drops redundant @@map on re-introspection [connectors: tags(Sqlite)]

### schema-engine/sql-introspection-tests/tests/lists/mod.rs

- [ ] `lists::scalar_list_types` — Scalar array columns are introspected as list fields [connectors: capabilities(ScalarLists)]

### schema-engine/sql-introspection-tests/tests/model_renames/mod.rs

- [ ] `model_renames::a_table_with_reserved_name` — Reserved-name table is renamed with @@map and comment [connectors: exclude(Postgres, CockroachDb)]
- [ ] `model_renames::reserved_names_case_sensitivity` — Lowercase near-reserved name is not renamed [connectors: exclude(CockroachDb)]

### schema-engine/sql-introspection-tests/tests/mssql/mod.rs

- [ ] `mssql::user_defined_type_aliases_should_map_to_the_system_type` — User-defined type alias maps to its underlying system type [connectors: tags(Mssql)]
- [ ] `mssql::ms_xml_indexes_are_skipped` — XML indexes are skipped during introspection [connectors: tags(Mssql)]
- [ ] `mssql::non_standard_id_clustering` — Nonclustered primary key introspects id with clustered:false [connectors: tags(Mssql)]
- [ ] `mssql::standard_id_clustering` — Clustered primary key introspects id without clustered attribute [connectors: tags(Mssql)]
- [ ] `mssql::non_standard_compound_id_clustering` — Nonclustered compound primary key gets @@id clustered:false [connectors: tags(Mssql)]
- [ ] `mssql::standard_compound_id_clustering` — Clustered compound primary key gets plain @@id [connectors: tags(Mssql)]
- [ ] `mssql::non_standard_unique_clustering` — Clustered unique constraint introspects @unique clustered:true [connectors: tags(Mssql)]
- [ ] `mssql::standard_unique_clustering` — Nonclustered unique constraint gets plain @unique [connectors: tags(Mssql)]
- [ ] `mssql::non_standard_compound_unique_clustering` — Clustered compound unique gets @@unique clustered:true [connectors: tags(Mssql)]
- [ ] `mssql::standard_compound_unique_clustering` — Nonclustered compound unique gets plain @@unique [connectors: tags(Mssql)]
- [ ] `mssql::non_standard_index_clustering` — Clustered index introspects @@index with clustered:true [connectors: tags(Mssql)]
- [ ] `mssql::standard_index_clustering` — Nonclustered index gets plain @@index [connectors: tags(Mssql)]

### schema-engine/sql-introspection-tests/tests/multi_schema/cockroach.rs

- [ ] `multi_schema::cockroach::multiple_schemas_w_tables_are_reintrospected` — Re-introspection corrects each model's @@schema to its actual namespace. [connectors: tags(CockroachDb) namespaces("first", "second")]
- [ ] `multi_schema::cockroach::multiple_schemas_w_duplicate_table_names_are_introspected` — Duplicate table names across schemas get schema-prefixed model names with @@map. [connectors: tags(CockroachDb) namespaces("first", "second")]
- [ ] `multi_schema::cockroach::multiple_schemas_w_cross_schema_are_reintrospected` — Re-introspection fixes @@schema on cross-schema relation models. [connectors: tags(CockroachDb) namespaces("first", "second")]
- [ ] `multi_schema::cockroach::multiple_schemas_w_enums_are_introspected` — Enums across two schemas introspected with per-enum @@schema attributes. [connectors: tags(CockroachDb) namespaces("first", "second_schema")]
- [ ] `multi_schema::cockroach::multiple_schemas_w_duplicate_enums_are_introspected` — Duplicate enum and model names across schemas get prefixed names with @@map. [connectors: tags(CockroachDb) namespaces("first", "second")]
- [ ] `multi_schema::cockroach::same_table_name_with_relation_in_two_schemas` — Same-named related tables in two schemas get prefixed names with @@map. [connectors: tags(CockroachDb) namespaces("first", "second_schema")]

### schema-engine/sql-introspection-tests/tests/multi_schema/postgres.rs

- [ ] `multi_schema::postgres::multiple_schemas_without_schema_property_are_not_introspected` — Only default-schema tables introspected when no schemas configured; other schemas ignored. [connectors: tags(Postgres)]
- [ ] `multi_schema::postgres::multiple_schemas_w_tables_are_introspected` — Tables across two configured schemas introspected with per-model @@schema attributes. [connectors: tags(Postgres) namespaces("first", "second")]
- [ ] `multi_schema::postgres::multiple_schemas_w_tables_are_reintrospected` — Re-introspection corrects each model's @@schema to its actual namespace. [connectors: tags(Postgres) exclude(CockroachDb) namespaces("first", "second")]
- [ ] `multi_schema::postgres::multiple_schemas_w_duplicate_table_names_are_introspected` — Duplicate table names across schemas get schema-prefixed model names with @@map and rename warnings. [connectors: tags(Postgres) exclude(CockroachDb) namespaces("first", "second")]
- [ ] `multi_schema::postgres::multiple_schemas_w_duplicate_sanitized_table_names_are_introspected` — Duplicate sanitized names across numeric-prefixed schemas get prefixed model names, @@map, warnings. [connectors: tags(Postgres) exclude(CockroachDb) namespaces("1first", "2second")]
- [ ] `multi_schema::postgres::multiple_schemas_w_cross_schema_are_introspected` — Cross-schema foreign key relation introspected with each model's @@schema. [connectors: tags(Postgres) namespaces("first", "second")]
- [ ] `multi_schema::postgres::multiple_schemas_w_cross_schema_are_reintrospected` — Re-introspection fixes @@schema on cross-schema relation models. [connectors: tags(Postgres) exclude(CockroachDb) namespaces("first", "second")]
- [ ] `multi_schema::postgres::multiple_schemas_w_cross_schema_fks_w_duplicate_names_are_introspected` — Cross-schema FK between duplicate-named tables yields prefixed model names with @@map. [connectors: tags(Postgres) namespaces("first", "second")]
- [ ] `multi_schema::postgres::multiple_schemas_w_enums_are_introspected` — Enums across two schemas introspected with per-enum @@schema attributes. [connectors: tags(Postgres) exclude(CockroachDb) namespaces("first", "second_schema")]
- [ ] `multi_schema::postgres::multiple_schemas_w_duplicate_enums_are_introspected` — Duplicate enum and model names across schemas get prefixed names, @@map, warnings. [connectors: tags(Postgres) exclude(CockroachDb) namespaces("first", "second")]
- [ ] `multi_schema::postgres::multiple_schemas_w_duplicate_models_are_reintrospected` — Re-introspection preserves existing @@map for duplicate models, warns of enrichment. [connectors: tags(Postgres) exclude(CockroachDb) namespaces("first", "second")]
- [ ] `multi_schema::postgres::multiple_schemas_w_duplicate_models_are_reintrospected_never_renamed` — Re-introspection keeps kept model unrenamed while prefixing the new duplicate. [connectors: tags(Postgres) exclude(CockroachDb) namespaces("first", "second")]
- [ ] `multi_schema::postgres::multiple_schemas_w_duplicate_enums_are_reintrospected` — Re-introspection preserves renamed enum's @@map, adds the second duplicate enum. [connectors: tags(Postgres) exclude(CockroachDb) namespaces("first", "second")]
- [ ] `multi_schema::postgres::multiple_schemas_w_enums_without_schemas_are_not_introspected` — Only default-schema enum introspected when no schemas configured; others ignored. [connectors: tags(Postgres)]
- [ ] `multi_schema::postgres::same_table_name_with_relation_in_two_schemas` — Same-named related tables in two schemas get prefixed names with @@map. [connectors: tags(Postgres) exclude(CockroachDb) namespaces("first", "second_schema")]

### schema-engine/sql-introspection-tests/tests/multi_schema/sql_server.rs

- [ ] `multi_schema::sql_server::multiple_schemas_without_schema_property_are_not_introspected` — Only default-schema table introspected when no schemas configured; others ignored. [connectors: tags(Mssql)]
- [ ] `multi_schema::sql_server::multiple_schemas_w_tables_are_introspected` — Tables from configured schemas introspected with @@schema; unconfigured schema excluded. [connectors: tags(Mssql) namespaces("first", "second")]
- [ ] `multi_schema::sql_server::multiple_schemas_w_tables_are_reintrospected` — Re-introspection adds missing columns while preserving models' @@schema. [connectors: tags(Mssql) namespaces("first", "second")]
- [ ] `multi_schema::sql_server::multiple_schemas_w_duplicate_table_names_are_introspected` — Duplicate table names across schemas get schema-prefixed model names with @@map. [connectors: tags(Mssql) namespaces("first", "second")]
- [ ] `multi_schema::sql_server::multiple_schemas_w_cross_schema_are_introspected` — Cross-schema foreign key relation introspected with each model's @@schema. [connectors: tags(Mssql) namespaces("first", "second")]
- [ ] `multi_schema::sql_server::multiple_schemas_w_cross_schema_are_reintrospected` — Re-introspection fixes @@schema on cross-schema relation models. [connectors: tags(Mssql) namespaces("first", "second")]
- [ ] `multi_schema::sql_server::multiple_schemas_w_cross_schema_fks_w_duplicate_names_are_introspected` — Cross-schema FK between duplicate-named tables yields prefixed model names with @@map. [connectors: tags(Mssql) namespaces("first", "second")]
- [ ] `multi_schema::sql_server::schemas_with_varying_case` — Tables across mixed-case schema names introspected with correct @@schema and PK map names. [connectors: tags(Mssql) namespaces("Appointments", "Trips", "core")]
- [ ] `multi_schema::sql_server::defaults_are_introspected` — Named column defaults across schemas introspected with default map names. [connectors: tags(Mssql) namespaces("first", "second")]

### schema-engine/sql-introspection-tests/tests/mysql/constraints.rs

- [ ] `mysql::constraints::check_constraints_stopgap` — Check constraints are dropped, commented, warned, and preserved on re-introspect [connectors: tags(Mysql8) exclude(Vitess)]

### schema-engine/sql-introspection-tests/tests/named_constraints/mod.rs

- [ ] `named_constraints::introspecting_non_default_pkey_names_works` — Custom primary key constraint names introspected into @id/@@id map arguments. [connectors: tags(Mssql, Postgres) exclude(CockroachDb)]
- [ ] `named_constraints::introspecting_default_pkey_names_works` — Default primary key constraint names omitted from @id/@@id output. [connectors: tags(Mssql, Postgres) exclude(CockroachDb)]
- [ ] `named_constraints::introspecting_non_default_unique_constraint_names_works` — Custom unique constraint names introspected into @unique/@@unique map arguments. [connectors: tags(Mssql, Postgres) exclude(CockroachDb)]
- [ ] `named_constraints::introspecting_default_unique_names_works` — Default unique constraint names omitted from @unique/@@unique output. [connectors: tags(Mssql, Postgres) exclude(CockroachDb)]
- [ ] `named_constraints::introspecting_non_default_index_names_works` — Custom index names introspected into @@index map arguments. [connectors: tags(Mssql, Postgres) exclude(CockroachDb)]
- [ ] `named_constraints::introspecting_default_index_names_works` — Default index names omitted from @@index output. [connectors: tags(Mssql, Postgres) exclude(CockroachDb)]
- [ ] `named_constraints::introspecting_default_fk_names_works` — Default foreign key constraint names omitted from @relation output. [connectors: exclude(Mssql, Mysql, CockroachDb)]
- [ ] `named_constraints::introspecting_custom_fk_names_works` — Custom foreign key constraint names introspected into @relation map argument. [connectors: exclude(Sqlite, Mssql, Mysql, CockroachDb)]
- [ ] `named_constraints::introspecting_custom_default_names_should_output_to_dml` — Custom default constraint names introspected into @default map arguments. [connectors: tags(Mssql)]
- [ ] `named_constraints::introspecting_default_default_names_should_not_output_to_dml` — Default default-constraint names omitted from @default output. [connectors: tags(Mssql)]

### schema-engine/sql-introspection-tests/tests/named_constraints/mssql.rs

- [ ] `named_constraints::mssql::introspecting_custom_fk_names_works` — Custom FK constraint name introspected into @relation map on SQL Server. [connectors: tags(Mssql)]
- [ ] `named_constraints::mssql::introspecting_default_fk_names_works` — Default FK constraint name omitted from @relation on SQL Server. [connectors: tags(Mssql)]

### schema-engine/sql-introspection-tests/tests/named_constraints/mysql.rs

- [ ] `named_constraints::mysql::introspecting_custom_fk_names_works` — Custom FK constraint name introspected into @relation map on MySQL. [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `named_constraints::mysql::introspecting_default_fk_names_works` — Default FK constraint name omitted from @relation on MySQL. [connectors: tags(Mysql) exclude(Vitess)]

### schema-engine/sql-introspection-tests/tests/named_constraints/sqlite.rs

- [ ] `named_constraints::sqlite::introspecting_custom_fk_names_does_not_return_them` — SQLite custom FK constraint names not introspected into @relation output. [connectors: tags(Sqlite)]

### schema-engine/sql-introspection-tests/tests/native_types/mssql.rs

- [ ] `native_types::mssql::native_type_columns_feature_on` — SQL Server column types map to expected @db.* native attributes [connectors: tags(Mssql)]

### schema-engine/sql-introspection-tests/tests/native_types/mysql.rs

- [ ] `native_types::mysql::native_type_columns_feature_on` — MySQL/MariaDB column types map to expected @db.* native attributes [connectors: tags(Mariadb, Mysql8)]

### schema-engine/sql-introspection-tests/tests/native_types/postgres.rs

- [ ] `native_types::postgres::native_type_columns_feature_on` — Postgres column types map to expected @db.* native attributes [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `native_types::postgres::native_type_array_columns_feature_on` — Postgres array column types map to list @db.* native attributes [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `native_types::postgres::cdb_char_is_a_char` — CockroachDB "char" type maps to @db.CatalogSingleChar [connectors: tags(CockroachDb)]

### schema-engine/sql-introspection-tests/tests/postgres/brin.rs

- [ ] `postgres::brin::bit_minmax_ops` — introspects BRIN index on bit column with default bit_minmax_ops into @@index type Brin [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::brin::varbit_minmax_ops` — introspects BRIN index on varbit column with default varbit_minmax_ops into @@index type Brin [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::brin::bpchar_minmax_ops` — introspects BRIN index on bpchar column with default bpchar_minmax_ops into @@index type Brin [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::brin::bpchar_bloom_ops` — introspects BRIN index on bpchar with BpcharBloomOps ops into @@index type Brin [connectors: tags(Postgres14) exclude(CockroachDb)]
- [ ] `postgres::brin::bytea_minmax_ops` — introspects BRIN index on bytea column with default bytea_minmax_ops into @@index type Brin [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::brin::bytea_bloom_ops` — introspects BRIN index on bytea with ByteaBloomOps ops into @@index type Brin [connectors: tags(Postgres14) exclude(CockroachDb)]
- [ ] `postgres::brin::date_minmax_ops` — introspects BRIN index on date column with default date_minmax_ops into @@index type Brin [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::brin::date_bloom_ops` — introspects BRIN index on date with DateBloomOps ops into @@index type Brin [connectors: tags(Postgres14) exclude(CockroachDb)]
- [ ] `postgres::brin::date_minmax_multi_ops` — introspects BRIN index on date with DateMinMaxMultiOps ops into @@index type Brin [connectors: tags(Postgres14) exclude(CockroachDb)]
- [ ] `postgres::brin::float_minmax_ops` — introspects BRIN index on real column with default float4_minmax_ops into @@index type Brin [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::brin::float_bloom_ops` — introspects BRIN index on real with Float4BloomOps ops into @@index type Brin [connectors: tags(Postgres14) exclude(CockroachDb)]
- [ ] `postgres::brin::float_minmax_multi_ops` — introspects BRIN index on real with Float4MinMaxMultiOps ops into @@index type Brin [connectors: tags(Postgres14) exclude(CockroachDb)]
- [ ] `postgres::brin::double_minmax_ops` — introspects BRIN index on double precision with default float8_minmax_ops into @@index type Brin [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::brin::double_bloom_ops` — introspects BRIN index on double precision with Float8BloomOps ops into @@index type Brin [connectors: tags(Postgres14) exclude(CockroachDb)]
- [ ] `postgres::brin::double_minmax_multi_ops` — introspects BRIN index on double precision with Float8MinMaxMultiOps ops into @@index type Brin [connectors: tags(Postgres14) exclude(CockroachDb)]
- [ ] `postgres::brin::inet_inclusion_ops` — introspects BRIN index on inet with default inet_inclusion_ops into @@index type Brin [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::brin::inet_bloom_ops` — introspects BRIN index on inet with InetBloomOps ops into @@index type Brin [connectors: tags(Postgres14) exclude(CockroachDb)]
- [ ] `postgres::brin::inet_minmax_ops` — introspects BRIN index on inet with InetMinMaxOps ops into @@index type Brin [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::brin::inet_minmax_multi_ops` — introspects BRIN index on inet with InetMinMaxMultiOps ops into @@index type Brin [connectors: tags(Postgres14) exclude(CockroachDb)]
- [ ] `postgres::brin::int2_bloom_ops` — introspects BRIN index on smallint with Int2BloomOps ops into @@index type Brin [connectors: tags(Postgres14) exclude(CockroachDb)]
- [ ] `postgres::brin::int2_minmax_ops` — introspects BRIN index on smallint with default int2_minmax_ops into @@index type Brin [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::brin::int2_minmax_multi_ops` — introspects BRIN index on smallint with Int2MinMaxMultiOps ops into @@index type Brin [connectors: tags(Postgres14) exclude(CockroachDb)]
- [ ] `postgres::brin::int4_bloom_ops` — introspects BRIN index on int with Int4BloomOps ops into @@index type Brin [connectors: tags(Postgres14) exclude(CockroachDb)]
- [ ] `postgres::brin::int4_minmax_ops` — introspects BRIN index on int with default int4_minmax_ops into @@index type Brin [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::brin::int4_minmax_multi_ops` — introspects BRIN index on int with Int4MinMaxMultiOps ops into @@index type Brin [connectors: tags(Postgres14) exclude(CockroachDb)]
- [ ] `postgres::brin::int8_bloom_ops` — introspects BRIN index on bigint with Int8BloomOps ops into @@index type Brin [connectors: tags(Postgres14) exclude(CockroachDb)]
- [ ] `postgres::brin::int8_minmax_ops` — introspects BRIN index on bigint with default int8_minmax_ops into @@index type Brin [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::brin::int8_minmax_multi_ops` — introspects BRIN index on bigint with Int8MinMaxMultiOps ops into @@index type Brin [connectors: tags(Postgres14) exclude(CockroachDb)]
- [ ] `postgres::brin::numeric_bloom_ops` — introspects BRIN index on decimal with NumericBloomOps ops into @@index type Brin [connectors: tags(Postgres14) exclude(CockroachDb)]
- [ ] `postgres::brin::numeric_minmax_ops` — introspects BRIN index on decimal with default numeric_minmax_ops into @@index type Brin [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::brin::numeric_minmax_multi_ops` — introspects BRIN index on decimal with NumericMinMaxMultiOps ops into @@index type Brin [connectors: tags(Postgres14) exclude(CockroachDb)]
- [ ] `postgres::brin::oid_bloom_ops` — introspects BRIN index on oid with OidBloomOps ops into @@index type Brin [connectors: tags(Postgres14) exclude(CockroachDb)]
- [ ] `postgres::brin::oid_minmax_ops` — introspects BRIN index on oid with default oid_minmax_ops into @@index type Brin [connectors: tags(Postgres14) exclude(CockroachDb)]
- [ ] `postgres::brin::oid_minmax_multi_ops` — introspects BRIN index on oid with OidMinMaxMultiOps ops into @@index type Brin [connectors: tags(Postgres14) exclude(CockroachDb)]
- [ ] `postgres::brin::text_bloom_ops` — introspects BRIN index on text with TextBloomOps ops into @@index type Brin [connectors: tags(Postgres14) exclude(CockroachDb)]
- [ ] `postgres::brin::text_minmax_ops` — introspects BRIN index on text with default text_minmax_ops into @@index type Brin [connectors: tags(Postgres14) exclude(CockroachDb)]
- [ ] `postgres::brin::timestamp_bloom_ops` — introspects BRIN index on timestamp with TimestampBloomOps ops into @@index type Brin [connectors: tags(Postgres14) exclude(CockroachDb)]
- [ ] `postgres::brin::timestamp_minmax_ops` — introspects BRIN index on timestamp with default timestamp_minmax_ops into @@index type Brin [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::brin::timestamp_minmax_multi_ops` — introspects BRIN index on timestamp with TimestampMinMaxMultiOps ops into @@index type Brin [connectors: tags(Postgres14) exclude(CockroachDb)]
- [ ] `postgres::brin::timestamptz_bloom_ops` — introspects BRIN index on timestamptz with TimestampTzBloomOps ops into @@index type Brin [connectors: tags(Postgres14) exclude(CockroachDb)]
- [ ] `postgres::brin::timestamptz_minmax_ops` — introspects BRIN index on timestamptz with default timestamptz_minmax_ops into @@index type Brin [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::brin::timestamptz_minmax_multi_ops` — introspects BRIN index on timestamptz with TimestampTzMinMaxMultiOps ops into @@index type Brin [connectors: tags(Postgres14) exclude(CockroachDb)]
- [ ] `postgres::brin::time_bloom_ops` — introspects BRIN index on time with TimeBloomOps ops into @@index type Brin [connectors: tags(Postgres14) exclude(CockroachDb)]
- [ ] `postgres::brin::time_minmax_ops` — introspects BRIN index on time with default time_minmax_ops into @@index type Brin [connectors: tags(Postgres14) exclude(CockroachDb)]
- [ ] `postgres::brin::time_minmax_multi_ops` — introspects BRIN index on time with TimeMinMaxMultiOps ops into @@index type Brin [connectors: tags(Postgres14) exclude(CockroachDb)]
- [ ] `postgres::brin::timetz_bloom_ops` — introspects BRIN index on timetz with TimeTzBloomOps ops into @@index type Brin [connectors: tags(Postgres14) exclude(CockroachDb)]
- [ ] `postgres::brin::timetz_minmax_ops` — introspects BRIN index on timetz with default timetz_minmax_ops into @@index type Brin [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::brin::timetz_minmax_multi_ops` — introspects BRIN index on timetz with TimeTzMinMaxMultiOps ops into @@index type Brin [connectors: tags(Postgres14) exclude(CockroachDb)]
- [ ] `postgres::brin::uuid_bloom_ops` — introspects BRIN index on uuid with UuidBloomOps ops into @@index type Brin [connectors: tags(Postgres14) exclude(CockroachDb)]
- [ ] `postgres::brin::uuid_minmax_ops` — introspects BRIN index on uuid with default uuid_minmax_ops into @@index type Brin [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::brin::uuid_minmax_multi_ops` — introspects BRIN index on uuid with UuidMinMaxMultiOps ops into @@index type Brin [connectors: tags(Postgres14) exclude(CockroachDb)]

### schema-engine/sql-introspection-tests/tests/postgres/constraints.rs

- [ ] `postgres::constraints::aragon_test_postgres` — Introspects check constraint table with warning, dropping unsupported check constraint. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::constraints::noalyss_folder_test_postgres` — Introspects multiple check constraints and column comments emitting combined warnings. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::constraints::check_and_exclusion_constraints_stopgap` — Introspects combined check and exclusion constraints emitting both stopgap warnings. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::constraints::exclusion_constraints_stopgap` — Introspects exclusion constraint emitting stopgap warning and doc comment. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::constraints::exclusion_constraints_without_where_stopgap` — Introspects exclusion constraint without WHERE clause emitting stopgap warning. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::constraints::exclusion_constraints_without_where_and_expressions_stopgap` — Introspects simple exclusion constraint without WHERE or expressions emitting warning. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::constraints::check_constraints_stopgap` — Introspects check constraint emitting stopgap warning and re-introspection comment. [connectors: tags(Postgres) exclude(CockroachDb)]

### schema-engine/sql-introspection-tests/tests/postgres/extensions.rs

- [ ] `postgres::extensions::should_work_with_the_preview_feature_enabled` — Introspects citext extension into datasource extensions with schema when preview feature enabled. [connectors: tags(Postgres) exclude(CockroachDb) preview_features("postgresqlExtensions")]
- [ ] `postgres::extensions::sanitizes_problematic_extension_names` — Sanitizes invalid extension name uuid-ossp to uuid_ossp with map attribute. [connectors: tags(Postgres) exclude(CockroachDb) preview_features("postgresqlExtensions")]
- [ ] `postgres::extensions::should_not_list_any_extensions_outside_of_allow_list` — Omits non-allow-listed extensions like amcheck from introspected extensions list. [connectors: tags(Postgres) exclude(CockroachDb, Postgres9) preview_features("postgresqlExtensions")]
- [ ] `postgres::extensions::should_not_remove_any_extensions_outside_of_allow_list` — Keeps user-listed non-allow-listed amcheck extension during re-introspection. [connectors: tags(Postgres) exclude(CockroachDb, Postgres9) preview_features("postgresqlExtensions")]
- [ ] `postgres::extensions::should_not_list_extensions_without_the_preview_feature` — Omits extensions entirely when postgresqlExtensions preview feature is disabled. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::extensions::should_keep_version_attribute_if_same_as_db` — Keeps extension version attribute when it matches the database version. [connectors: tags(Postgres14) exclude(CockroachDb) preview_features("postgresqlExtensions")]
- [ ] `postgres::extensions::should_update_version_attribute_if_different_than_db` — Updates extension version attribute to match the actual database version. [connectors: tags(Postgres14) exclude(CockroachDb) preview_features("postgresqlExtensions")]
- [ ] `postgres::extensions::should_keep_schema_attribute_if_same_as_db` — Keeps extension schema attribute when it matches the database schema. [connectors: tags(Postgres) exclude(CockroachDb) preview_features("postgresqlExtensions")]
- [ ] `postgres::extensions::should_update_schema_attribute_if_different_than_db` — Updates extension schema attribute to match the actual database schema. [connectors: tags(Postgres) exclude(CockroachDb) preview_features("postgresqlExtensions")]
- [ ] `postgres::extensions::should_remove_missing_extensions` — Removes extensions from schema that no longer exist in the database. [connectors: tags(Postgres) exclude(CockroachDb) preview_features("postgresqlExtensions")]
- [ ] `postgres::extensions::no_extensions_means_no_extensions` — Emits no extensions attribute when the database has no extensions. [connectors: tags(Postgres) exclude(CockroachDb) preview_features("postgresqlExtensions")]
- [ ] `postgres::extensions::introspect_extension_type` — Introspects vector column to configured Vector3 extension type with modifiers. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::extensions::introspect_specific_extension_type_by_type_modifier` — Selects specific extension type by matching type modifier count over generic. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::extensions::introspect_extension_type_with_modifier` — Introspects vector column to VectorN type retaining native db.vector modifier. [connectors: tags(Postgres) exclude(CockroachDb)]

### schema-engine/sql-introspection-tests/tests/postgres/gin.rs

- [ ] `postgres::gin::full_text_functions_filtered_out` — filters out GIN expression index on to_tsvector, keeping only the model with warning [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::gin::gin_raw_ops` — introspects GIN index on tsvector Unsupported column into @@index type Gin [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::gin::array_ops` — introspects GIN index on int array column into @@index type Gin [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::gin::array_ops_with_native_type` — introspects GIN index on int array column into @@index type Gin [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::gin::jsonb_ops` — introspects GIN index on jsonb with default jsonb_ops into @@index type Gin [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::gin::jsonb_path_ops` — introspects GIN index on jsonb with JsonbPathOps ops into @@index type Gin [connectors: tags(Postgres) exclude(CockroachDb)]

### schema-engine/sql-introspection-tests/tests/postgres/gist.rs

- [ ] `postgres::gist::gist_inet_ops` — introspects GiST index on inet with InetOps ops into @@index type Gist [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::gist::gist_raw_ops` — introspects GiST index on tsvector Unsupported column with default ops into @@index type Gist [connectors: tags(Postgres) exclude(CockroachDb)]

### schema-engine/sql-introspection-tests/tests/postgres/mod.rs

- [ ] `postgres::sequences_should_work` — Introspects nextval sequence defaults into autoincrement across Int and BigInt. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::dbgenerated_type_casts_should_work` — Introspects casted default expression into dbgenerated with preserved type cast. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::pg_xml_indexes_are_skipped` — Introspects XML expression index into model with expression-index comment. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::scalar_list_defaults_work` — Introspects scalar list array defaults including enums, ints, and datetimes. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::index_sort_order_stopgap` — Introspects non-default null sort order indexes emitting stopgap warnings. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::deferrable_stopgap` — Introspects deferrable constraints emitting non-default deferring stopgap warnings. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::commenting_stopgap` — Introspects table, view, enum, and column comments emitting comment warnings. [connectors: tags(Postgres) exclude(CockroachDb) preview_features("views")]

### schema-engine/sql-introspection-tests/tests/postgres/spgist.rs

- [ ] `postgres::spgist::spgist_raw_ops` — introspects SP-GiST index on box Unsupported column into @@index type SpGist [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::spgist::spgist_inet_ops` — introspects SP-GiST index on inet column into @@index type SpGist [connectors: tags(Postgres) exclude(CockroachDb, Postgres9)]
- [ ] `postgres::spgist::spgist_text_ops` — introspects SP-GiST index on text column into @@index type SpGist [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `postgres::spgist::spgist_text_ops_varchar` — introspects SP-GiST index on varchar(420) column into @@index type SpGist [connectors: tags(Postgres) exclude(CockroachDb)]

### schema-engine/sql-introspection-tests/tests/re_introspection/mod.rs

- [ ] `re_introspection::mapped_model_name` — Re-introspection preserves custom model name via @@map from previous schema. [connectors: exclude(CockroachDb)]
- [ ] `re_introspection::manually_overwritten_mapped_field_name` — Re-introspection preserves manually mapped field name via @map. [connectors: exclude(CockroachDb)]
- [ ] `re_introspection::mapped_model_and_field_name` — Re-introspection preserves both @@map model and @map field names. [connectors: exclude(Mssql, Mysql, CockroachDb)]
- [ ] `re_introspection::manually_mapped_model_and_field_name` — Re-introspection preserves manually mapped model and field names with underscores. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `re_introspection::mapped_field_name` — Re-introspection preserves @map field names in id, index, and unique attributes. [connectors: exclude(CockroachDb)]
- [ ] `re_introspection::mapped_enum_name` — Re-introspection preserves custom enum name via @@map. [connectors: exclude(CockroachDb, Sqlite) capabilities(Enums)]
- [ ] `re_introspection::manually_remapped_enum_value_name` — Re-introspection preserves manually mapped enum value name via @map. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `re_introspection::manually_re_mapped_enum_name` — Re-introspection preserves manually re-mapped enum name via @@map. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `re_introspection::manually_re_mapped_invalid_enum_values` — Re-introspection preserves manual @map for invalid enum value names. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `re_introspection::multiple_changed_relation_names` — Re-introspection keeps multiple custom relation names between two models. [connectors: exclude(Mysql, Mssql, CockroachDb, Sqlite)]
- [ ] `re_introspection::custom_virtual_relation_field_names` — Re-introspection preserves custom virtual relation field names. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `re_introspection::custom_model_order` — Re-introspection preserves existing model order, appending new models. [connectors: exclude(CockroachDb)]
- [ ] `re_introspection::custom_enum_order` — Re-introspection preserves existing enum order, appending new enums. [connectors: tags(Postgres)]
- [ ] `re_introspection::multiple_changed_relation_names_due_to_mapped_models` — Re-introspection keeps custom relation names when model is @@map-renamed. [connectors: exclude(Mssql, Mysql, Sqlite, CockroachDb)]
- [ ] `re_introspection::virtual_uid_default` — Re-introspection preserves virtual cuid/uuid/nanoid/ulid default functions. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `re_introspection::virtual_cuid_default_cockroach` — Re-introspection preserves virtual cuid/uuid/ulid defaults on CockroachDB. [connectors: tags(CockroachDb)]
- [ ] `re_introspection::comments_should_be_kept` — Re-introspection keeps model, field, and enum documentation comments. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `re_introspection::updated_at` — Re-introspection preserves @updatedAt attribute on datetime field. [connectors: exclude(Mssql, CockroachDb)]
- [ ] `re_introspection::multiple_many_to_many_on_same_model` — Re-introspection keeps custom names for multiple m2m relations between same models. [connectors: exclude(Vitess, CockroachDb)]
- [ ] `re_introspection::re_introspecting_mysql_enum_names` — Re-introspection preserves custom MySQL inline enum name. [connectors: tags(Mysql)]
- [ ] `re_introspection::re_introspecting_mysql_enum_names_if_enum_is_reused` — Re-introspection preserves custom enum name when reused across two columns. [connectors: tags(Mysql)]
- [ ] `re_introspection::custom_repro` — Re-introspection preserves custom relation name and @@map on Tag. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `re_introspection::re_introspecting_ignore` — Re-introspection preserves @ignore and @@ignore attributes. [connectors: exclude(CockroachDb)]
- [ ] `re_introspection::do_not_try_to_keep_custom_many_to_many_self_relation_names` — Re-introspection discards custom names for m2m self-relation fields, using generated names. [connectors: exclude(Vitess, CockroachDb, Sqlite)]
- [ ] `re_introspection::re_introspecting_custom_compound_unique_upgrade` — Re-introspection upgrades compound unique with map argument. [connectors: tags(Postgres, Mssql, Mysql, Sqlite) exclude(CockroachDb)]
- [ ] `re_introspection::re_introspecting_custom_index_order` — Re-introspection preserves existing GIN index order, appending new index. [connectors: tags(Postgres12)]
- [ ] `re_introspection::re_introspecting_with_schemas_property` — Re-introspection keeps schemas config, adding models with @@schema. [connectors: tags(Postgres)]

### schema-engine/sql-introspection-tests/tests/re_introspection/mssql.rs

- [ ] `re_introspection::mssql::multiple_changed_relation_names` — Custom relation names preserved with foreign-key map names added. [connectors: tags(Mssql)]
- [ ] `re_introspection::mssql::multiple_changed_relation_names_due_to_mapped_models` — Custom relation names kept across mapped models with map args. [connectors: tags(Mssql)]
- [ ] `re_introspection::mssql::mapped_model_and_field_name` — @map and @@map names preserved, emitting enrichment warnings. [connectors: tags(Mssql)]
- [ ] `re_introspection::mssql::updated_at` — @updatedAt attribute preserved and native type moved correctly. [connectors: tags(Mssql)]
- [ ] `re_introspection::mssql::re_introspecting_custom_compound_id_names` — Custom compound @@id names preserved with enrichment warning. [connectors: tags(Mssql)]
- [ ] `re_introspection::mssql::re_introspecting_custom_compound_unique_names` — Custom compound @@unique names preserved on re-introspection. [connectors: tags(Mssql)]

### schema-engine/sql-introspection-tests/tests/re_introspection/multi_file.rs

- [ ] `re_introspection::multi_file::reintrospect_new_model_single_file` — Re-introspection adds new model to single-file schema. [connectors: exclude(CockroachDb)]
- [ ] `re_introspection::multi_file::reintrospect_new_model_multi_file` — Re-introspection places new model in separate introspected file. [connectors: exclude(CockroachDb)]
- [ ] `re_introspection::multi_file::reintrospect_removed_model_single_file` — Re-introspection removes dropped model from single-file schema. [connectors: exclude(CockroachDb)]
- [ ] `re_introspection::multi_file::reintrospect_removed_model_multi_file` — Re-introspection removes dropped model across multi-file schema. [connectors: exclude(CockroachDb)]
- [ ] `re_introspection::multi_file::reintrospect_force_single_file` — Force re-introspection replaces single-file schema with fresh datamodel. [connectors: exclude(CockroachDb)]
- [ ] `re_introspection::multi_file::reintrospect_force_multi_file` — Force re-introspection consolidates multi-file schema into introspected file. [connectors: exclude(CockroachDb)]
- [ ] `re_introspection::multi_file::reintrospect_force_invalid_config` — Force re-introspection errors on unsupported schemas property in config. [connectors: exclude(CockroachDb)]
- [ ] `re_introspection::multi_file::reintrospect_new_enum_single_file` — Re-introspection adds new enum to single-file schema. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `re_introspection::multi_file::reintrospect_removed_enum_single_file` — Re-introspection removes dropped enum from single-file schema. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `re_introspection::multi_file::reintrospect_new_enum_multi_file` — Re-introspection places new enum in separate introspected file. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `re_introspection::multi_file::reintrospect_removed_enum_multi_file` — Re-introspection removes dropped enum across multi-file schema. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `re_introspection::multi_file::introspect_multi_view_preview_feature_is_required` — Introspection omits views without the views preview feature enabled. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `re_introspection::multi_file::reintrospect_new_view_single_file` — Re-introspection adds new view to single-file schema. [connectors: tags(Postgres) exclude(Postgres16, CockroachDb) preview_features("views")]
- [ ] `re_introspection::multi_file::reintrospect_removed_view_single_file` — Re-introspection removes dropped view from single-file schema. [connectors: tags(Postgres) exclude(Postgres16, CockroachDb) preview_features("views")]
- [ ] `re_introspection::multi_file::reintrospect_new_view_multi_file` — Re-introspection places new view in separate introspected file. [connectors: tags(Postgres) exclude(Postgres16, CockroachDb) preview_features("views")]
- [ ] `re_introspection::multi_file::reintrospect_removed_view_multi_file` — Re-introspection removes dropped view across multi-file schema. [connectors: tags(Postgres) exclude(Postgres16, CockroachDb) preview_features("views")]
- [ ] `re_introspection::multi_file::reintrospect_keep_configuration_in_same_file` — Re-introspection keeps generator/datasource config in its original file. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `re_introspection::multi_file::reintrospect_keep_configuration_when_spread_across_files` — Re-introspection keeps generator and datasource in their separate files. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `re_introspection::multi_file::reintrospect_keep_configuration_when_no_models` — Re-introspection keeps config blocks in files even without models. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `re_introspection::multi_file::reintrospect_empty_multi_file` — Re-introspection keeps config, dropping empty model files. [connectors: tags(Postgres) exclude(CockroachDb)]

### schema-engine/sql-introspection-tests/tests/re_introspection/mysql.rs

- [ ] `re_introspection::mysql::empty_preview_features_are_kept` — Config without preview features re-introspects unchanged. [connectors: tags(Mysql)]
- [ ] `re_introspection::mysql::relation_mode_parameter_is_not_added` — Non-Vitess MySQL does not add relationMode to datasource. [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `re_introspection::mysql::multiple_changed_relation_names` — Custom relation names preserved with added map arguments. [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `re_introspection::mysql::mapped_model_and_field_name` — @map and @@map names preserved, emitting enrichment warnings. [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `re_introspection::mysql::multiple_changed_relation_names_due_to_mapped_models` — Custom relation names kept across mapped models with map args. [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `re_introspection::mysql::mysql_keeps_renamed_enum_defaults` — Renamed enum value defaults preserved with @map warnings. [connectors: tags(Mysql)]
- [ ] `re_introspection::mysql::mapped_enum_value_name` — Mapped enum value names preserved, warning about @map enrichment. [connectors: tags(Mysql)]

### schema-engine/sql-introspection-tests/tests/re_introspection/postgresql.rs

- [ ] `re_introspection::postgresql::re_introspecting_custom_compound_id_names` — Custom compound @@id names preserved with enrichment warning. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `re_introspection::postgresql::re_introspecting_custom_compound_unique_names` — Custom compound @@unique names preserved on re-introspection. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `re_introspection::postgresql::mapped_enum_value_name` — Mapped enum value names preserved, warning about @map enrichment. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `re_introspection::postgresql::ignore_docs_only_added_once` — @@ignore model doc comment not duplicated on re-introspection. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `re_introspection::postgresql::reserved_name_docs_are_only_added_once` — Reserved-name rename doc comment not duplicated on re-introspection. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `re_introspection::postgresql::re_introspecting_uuid_default_on_uuid_typed_pk_field` — uuid() default kept on UUID-typed primary key field. [connectors: tags(Postgres)]

### schema-engine/sql-introspection-tests/tests/re_introspection/relation_mode/mssql.rs

- [ ] `re_introspection::relation_mode::mssql::referential_integrity_prisma` — referentialIntegrity="prisma" renamed to relationMode="prisma", relations preserved. [connectors: tags(Mssql)]
- [ ] `re_introspection::relation_mode::mssql::referential_integrity_foreign_keys` — referentialIntegrity="foreignKeys" renamed to relationMode, relations moved to bottom. [connectors: tags(Mssql)]
- [ ] `re_introspection::relation_mode::mssql::relation_mode_prisma` — relationMode="prisma" and @relations preserved on re-introspection. [connectors: tags(Mssql)]
- [ ] `re_introspection::relation_mode::mssql::relation_mode_foreign_keys` — relationMode="foreignKeys" preserved, relations moved to bottom. [connectors: tags(Mssql)]
- [ ] `re_introspection::relation_mode::mssql::referential_integrity_prisma_at_map_map` — referentialIntegrity="prisma" renamed, relations and @@map preserved. [connectors: tags(Mssql)]
- [ ] `re_introspection::relation_mode::mssql::referential_integrity_foreign_keys_at_map_map` — referentialIntegrity="foreignKeys" renamed, relations and @@map preserved. [connectors: tags(Mssql)]
- [ ] `re_introspection::relation_mode::mssql::relation_mode_prisma_at_map_map` — relationMode="prisma" preserved with mapped models and relations. [connectors: tags(Mssql)]
- [ ] `re_introspection::relation_mode::mssql::relation_mode_foreign_keys_at_map_map` — relationMode="foreignKeys" preserved with mapped models, relations moved down. [connectors: tags(Mssql)]

### schema-engine/sql-introspection-tests/tests/re_introspection/relation_mode/mysql.rs

- [ ] `re_introspection::relation_mode::mysql::referential_integrity_prisma` — referentialIntegrity="prisma" renamed to relationMode="prisma", relations preserved. [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `re_introspection::relation_mode::mysql::referential_integrity_foreign_keys` — referentialIntegrity="foreignKeys" renamed to relationMode, relations moved to bottom. [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `re_introspection::relation_mode::mysql::relation_mode_prisma` — relationMode="prisma" and @relations preserved on re-introspection. [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `re_introspection::relation_mode::mysql::relation_mode_foreign_keys` — relationMode="foreignKeys" preserved, relations moved to bottom. [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `re_introspection::relation_mode::mysql::referential_integrity_prisma_at_map_map` — referentialIntegrity="prisma" renamed, relations and @@map preserved. [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `re_introspection::relation_mode::mysql::referential_integrity_foreign_keys_at_map_map` — referentialIntegrity="foreignKeys" renamed, relations and @@map preserved. [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `re_introspection::relation_mode::mysql::relation_mode_prisma_at_map_map` — relationMode="prisma" preserved with mapped models and relations. [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `re_introspection::relation_mode::mysql::relation_mode_foreign_keys_at_map_map` — relationMode="foreignKeys" preserved with mapped models, relations moved down. [connectors: tags(Mysql) exclude(Vitess)]

### schema-engine/sql-introspection-tests/tests/re_introspection/relation_mode/postgres.rs

- [ ] `re_introspection::relation_mode::postgres::referential_integrity_prisma` — referentialIntegrity="prisma" renamed to relationMode="prisma", relations preserved. [connectors: tags(Postgres)]
- [ ] `re_introspection::relation_mode::postgres::referential_integrity_foreign_keys` — referentialIntegrity="foreignKeys" renamed to relationMode, relations moved to bottom. [connectors: tags(Postgres)]
- [ ] `re_introspection::relation_mode::postgres::relation_mode_prisma` — relationMode="prisma" and @relations preserved on re-introspection. [connectors: tags(Postgres)]
- [ ] `re_introspection::relation_mode::postgres::relation_mode_foreign_keys` — relationMode="foreignKeys" preserved, relations moved to bottom. [connectors: tags(Postgres)]
- [ ] `re_introspection::relation_mode::postgres::referential_integrity_prisma_at_map_map` — referentialIntegrity="prisma" renamed, relations and @@map preserved. [connectors: tags(Postgres)]
- [ ] `re_introspection::relation_mode::postgres::referential_integrity_foreign_keys_at_map_map` — referentialIntegrity="foreignKeys" renamed, relations and @@map preserved. [connectors: tags(Postgres)]
- [ ] `re_introspection::relation_mode::postgres::relation_mode_prisma_at_map_map` — relationMode="prisma" preserved with mapped models and relations. [connectors: tags(Postgres)]
- [ ] `re_introspection::relation_mode::postgres::relation_mode_foreign_keys_at_map_map` — relationMode="foreignKeys" preserved with mapped models, relations moved down. [connectors: tags(Postgres)]

### schema-engine/sql-introspection-tests/tests/re_introspection/relation_mode/sqlite.rs

- [ ] `re_introspection::relation_mode::sqlite::referential_integrity_prisma` — referentialIntegrity="prisma" renamed to relationMode="prisma", relations preserved. [connectors: tags(Sqlite)]
- [ ] `re_introspection::relation_mode::sqlite::referential_integrity_foreign_keys` — referentialIntegrity="foreignKeys" renamed to relationMode, relations moved to bottom. [connectors: tags(Sqlite)]
- [ ] `re_introspection::relation_mode::sqlite::relation_mode_prisma` — relationMode="prisma" and @relations preserved on re-introspection. [connectors: tags(Sqlite)]
- [ ] `re_introspection::relation_mode::sqlite::relation_mode_foreign_keys` — relationMode="foreignKeys" preserved, relations moved to bottom. [connectors: tags(Sqlite)]
- [ ] `re_introspection::relation_mode::sqlite::referential_integrity_prisma_at_map_map` — referentialIntegrity="prisma" renamed, relations and @@map preserved. [connectors: tags(Sqlite)]
- [ ] `re_introspection::relation_mode::sqlite::referential_integrity_foreign_keys_at_map_map` — referentialIntegrity="foreignKeys" renamed, relations and @@map preserved. [connectors: tags(Sqlite)]
- [ ] `re_introspection::relation_mode::sqlite::relation_mode_prisma_at_map_map` — relationMode="prisma" preserved with mapped models and relations. [connectors: tags(Sqlite)]
- [ ] `re_introspection::relation_mode::sqlite::relation_mode_foreign_keys_at_map_map` — relationMode="foreignKeys" preserved with mapped models, relations moved down. [connectors: tags(Sqlite)]

### schema-engine/sql-introspection-tests/tests/re_introspection/sqlite.rs

- [ ] `re_introspection::sqlite::multiple_changed_relation_names_due_to_mapped_models` — SQLite re-introspection keeps custom relation names when model is @@map-renamed. [connectors: tags(Sqlite)]
- [ ] `re_introspection::sqlite::do_not_try_to_keep_custom_many_to_many_self_relation_field_names` — SQLite re-introspection discards custom m2m self-relation field names. [connectors: tags(Sqlite)]
- [ ] `re_introspection::sqlite::multiple_changed_relation_names` — SQLite re-introspection keeps multiple custom relation names between two models. [connectors: tags(Sqlite)]

### schema-engine/sql-introspection-tests/tests/re_introspection/vitess.rs

- [ ] `re_introspection::vitess::relation_mode_parameter_is_not_removed` — Re-introspecting Vitess keeps existing relationMode="prisma" in datasource. [connectors: tags(Vitess)]
- [ ] `re_introspection::vitess::relations_are_not_removed` — Copied @relations without foreign keys are preserved on re-introspection. [connectors: tags(Vitess)]
- [ ] `re_introspection::vitess::warning_is_given_for_copied_relations` — Warns that relations were copied due to missing foreign keys. [connectors: tags(Vitess)]
- [ ] `re_introspection::vitess::no_warnings_are_given_for_if_no_relations_were_copied` — No warning emitted when schema has no relations to copy. [connectors: tags(Vitess)]
- [ ] `re_introspection::vitess::relations_field_order_is_kept` — Existing field order is preserved when re-introspecting relations. [connectors: tags(Vitess)]
- [ ] `re_introspection::vitess::relations_field_order_is_kept_if_having_new_fields` — Field order kept while appending newly added database columns. [connectors: tags(Vitess)]
- [ ] `re_introspection::vitess::relations_field_order_is_kept_if_removing_fields` — Field order kept while dropping fields absent from database. [connectors: tags(Vitess)]
- [ ] `re_introspection::vitess::deleting_models_will_delete_relations` — Relations to deleted models are removed on re-introspection. [connectors: tags(Vitess)]
- [ ] `re_introspection::vitess::field_renames_keeps_the_relation_intact` — Renamed relation scalar field keeps the relation attribute intact. [connectors: tags(Vitess)]
- [ ] `re_introspection::vitess::referential_actions_are_kept_intact` — Referential actions like onDelete are preserved on re-introspection. [connectors: tags(Vitess)]

### schema-engine/sql-introspection-tests/tests/referential_actions/cockroachdb.rs

- [ ] `referential_actions::cockroachdb::default_referential_actions_with_restrict` — Restrict/Cascade default actions are omitted on CockroachDB [connectors: tags(CockroachDb)]
- [ ] `referential_actions::cockroachdb::referential_actions` — Cascade/NoAction onDelete/onUpdate actions are introspected [connectors: tags(CockroachDb)]

### schema-engine/sql-introspection-tests/tests/referential_actions/mod.rs

- [ ] `referential_actions::referential_actions` — Cascade/NoAction onDelete/onUpdate actions are introspected [connectors: exclude(Mysql, Mssql, Sqlite, CockroachDb)]
- [ ] `referential_actions::referential_actions_mysql` — MySQL introspects referential actions plus foreign-key index [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `referential_actions::default_referential_actions_with_restrict_postgres` — Restrict/Cascade default actions are omitted on Postgres [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `referential_actions::default_referential_actions_with_restrict_sqlite` — Restrict/Cascade default actions are omitted on SQLite [connectors: tags(Sqlite)]
- [ ] `referential_actions::default_referential_actions_with_restrict_mysql` — Restrict/Cascade default actions are omitted on MySQL [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `referential_actions::default_optional_actions_mysql` — SetNull/Cascade default actions on optional relation are omitted [connectors: tags(Mysql) exclude(Vitess)]

### schema-engine/sql-introspection-tests/tests/referential_actions/mysql.rs

- [ ] `referential_actions::mysql::introspect_set_default_should_warn` — SetDefault referential action is introspected with a validation warning [connectors: tags(Mysql8) exclude(Vitess)]

### schema-engine/sql-introspection-tests/tests/referential_actions/sqlite.rs

- [ ] `referential_actions::sqlite::referential_actions` — Cascade/NoAction onDelete/onUpdate actions are introspected [connectors: tags(Sqlite)]

### schema-engine/sql-introspection-tests/tests/relations/cockroachdb.rs

- [ ] `relations::cockroachdb::a_one_to_one_relation_referencing_non_id` — CockroachDB 1-1 relation referencing non-id unique column with BigInt ids [connectors: tags(CockroachDb)]
- [ ] `relations::cockroachdb::default_values_on_relations` — CockroachDB FK column with default value keeps default in relation [connectors: tags(CockroachDb)]
- [ ] `relations::cockroachdb::a_self_relation` — CockroachDB two self-referencing FKs produce named self-relations [connectors: tags(CockroachDb)]
- [ ] `relations::cockroachdb::a_many_to_many_relation_with_an_id` — CockroachDB join table with id becomes model with relations [connectors: tags(CockroachDb)]

### schema-engine/sql-introspection-tests/tests/relations/mod.rs

- [ ] `relations::one_to_one_req_relation` — Required 1-1 FK on unique column yields required back-relation and optional inverse [connectors: exclude(Mssql, Mysql, Sqlite, CockroachDb)]
- [ ] `relations::one_to_one_relation_on_a_singular_primary_key` — 1-1 relation where FK is the unique primary key column [connectors: exclude(Mssql, Mysql, Sqlite, CockroachDb)]
- [ ] `relations::two_one_to_one_relations_between_the_same_models` — Two 1-1 relations between same models get disambiguated relation names [connectors: exclude(Mssql, Mysql, Sqlite, CockroachDb)]
- [ ] `relations::a_one_to_one_relation` — Nullable unique FK produces optional 1-1 relation both sides [connectors: exclude(Mysql, Sqlite, CockroachDb)]
- [ ] `relations::a_one_to_one_relation_referencing_non_id` — 1-1 relation referencing a non-id unique column [connectors: exclude(Sqlite, Mysql, CockroachDb)]
- [ ] `relations::a_one_to_many_relation` — Nullable non-unique FK yields optional many-side with list back-relation [connectors: exclude(Mysql, Sqlite, CockroachDb)]
- [ ] `relations::a_one_req_to_many_relation` — Required non-unique FK yields required relation with list back-relation [connectors: exclude(Mysql, Mssql, CockroachDb)]
- [ ] `relations::a_prisma_many_to_many_relation` — Implicit _PostToUser join table introspects as m-n relation lists [connectors: exclude(Postgres, Vitess, CockroachDb)]
- [ ] `relations::a_broken_prisma_many_to_many_relation` — Re-introspecting @@map-renamed model warns about broken m-n ordering [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `relations::a_many_to_many_relation_with_an_id` — Explicit join table with id becomes its own model with relations [connectors: exclude(Mysql, Mssql, CockroachDb, Sqlite)]
- [ ] `relations::a_self_relation` — Two self-referencing FKs produce named self-relations with back-relations [connectors: exclude(Mysql, Sqlite, CockroachDb, Mssql)]
- [ ] `relations::id_fields_with_foreign_key` — Primary key column that is also a foreign key [connectors: exclude(Sqlite, Mssql, Mysql, CockroachDb)]
- [ ] `relations::duplicate_fks_should_ignore_one_of_them` — Duplicate foreign keys collapse, ignoring one of them [connectors: exclude(Sqlite, Mysql, CockroachDb)]
- [ ] `relations::prisma_1_0_relations` — Prisma 1.0 char-id implicit join table introspects as m-n [connectors: exclude(Mssql, Vitess)]
- [ ] `relations::relations_should_avoid_name_clashes` — Relation field names avoid clashing with scalar column names [connectors: exclude(Mysql, Sqlite, Mssql)]
- [ ] `relations::one_to_many_relation_field_names_do_not_conflict_with_many_to_many_relation_field_names` — 1-n and m-n relation field names between same models stay distinct [connectors: exclude(Mysql, Mssql, CockroachDb)]
- [ ] `relations::one_to_one_req_relation_with_custom_fk_name` — Required 1-1 relation preserves custom FK constraint name via map [connectors: exclude(Sqlite, Mssql, Mysql, CockroachDb)]

### schema-engine/sql-introspection-tests/tests/relations/mssql.rs

- [ ] `relations::mssql::two_one_to_one_relations_between_the_same_models` — MSSQL two 1-1 relations between same models get disambiguated names [connectors: tags(Mssql)]
- [ ] `relations::mssql::a_many_to_many_relation_with_an_id` — MSSQL join table with id becomes model with mapped FKs [connectors: tags(Mssql)]
- [ ] `relations::mssql::a_one_req_to_many_relation` — MSSQL required non-unique FK yields required relation with list back-relation [connectors: tags(Mssql)]
- [ ] `relations::mssql::id_fields_with_foreign_key` — MSSQL primary key column that is also a foreign key [connectors: tags(Mssql)]
- [ ] `relations::mssql::one_to_many_relation_field_names_do_not_conflict_with_many_to_many_relation_field_names` — MSSQL 1-n and m-n relation field names stay distinct [connectors: tags(Mssql)]
- [ ] `relations::mssql::one_to_one_relation_on_a_singular_primary_key` — MSSQL 1-1 relation where FK is the unique primary key [connectors: tags(Mssql)]
- [ ] `relations::mssql::one_to_one_req_relation_with_custom_fk_name` — MSSQL required 1-1 relation preserves custom FK name via map [connectors: tags(Mssql)]
- [ ] `relations::mssql::one_to_one_req_relation` — MSSQL required 1-1 FK on unique column [connectors: tags(Mssql)]
- [ ] `relations::mssql::relations_should_avoid_name_clashes` — MSSQL relation field names avoid clashing with scalar columns [connectors: tags(Mssql)]
- [ ] `relations::mssql::relations_should_avoid_name_clashes_2` — MSSQL compound-FK relations avoid name clashes with disambiguated names [connectors: tags(Mssql)]
- [ ] `relations::mssql::multiple_foreign_key_constraints_are_taken_always_in_the_same_order` — MSSQL duplicate FKs deterministically pick same one across ten introspections [connectors: tags(Mssql)]
- [ ] `relations::mssql::a_self_relation` — MSSQL two self-referencing FKs produce named self-relations [connectors: tags(Mssql)]

### schema-engine/sql-introspection-tests/tests/relations/mysql.rs

- [ ] `relations::mysql::a_many_to_many_relation_with_an_id` — MySQL join table with id becomes model, FKs mapped with indexes [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `relations::mysql::a_one_req_to_many_relation` — MySQL required non-unique FK yields required relation with index and list [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `relations::mysql::a_one_to_many_relation` — MySQL nullable FK yields optional many-side relation with index [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `relations::mysql::a_self_relation` — MySQL two self-referencing FKs produce named self-relations with indexes [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `relations::mysql::duplicate_fks_should_ignore_one_of_them` — MySQL single FK yields optional relation with mapped index [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `relations::mysql::one_to_many_relation_field_names_do_not_conflict_with_many_to_many_relation_field_names` — MySQL 1-n and m-n relation field names stay distinct [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `relations::mysql::relations_should_avoid_name_clashes` — MySQL relation field names avoid clashing with scalar columns [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `relations::mysql::relations_should_avoid_name_clashes_2` — MySQL compound-FK relations avoid name clashes with disambiguated names [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `relations::mysql::two_one_to_one_relations_between_the_same_models` — MySQL two 1-1 relations between same models get disambiguated names [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `relations::mysql::a_one_to_one_relation` — MySQL nullable unique FK produces optional 1-1 relation [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `relations::mysql::a_one_to_one_relation_referencing_non_id` — MySQL 1-1 relation referencing non-id unique column [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `relations::mysql::id_fields_with_foreign_key` — MySQL primary key column that is also a foreign key [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `relations::mysql::one_to_one_req_relation_with_custom_fk_name` — MySQL required 1-1 relation preserves custom FK name via map [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `relations::mysql::one_to_one_req_relation` — MySQL required 1-1 FK on unique column with mapped names [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `relations::mysql::one_to_one_relation_on_a_singular_primary_key` — MySQL 1-1 relation where FK is unique primary key [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `relations::mysql::multiple_foreign_key_constraints_are_taken_always_in_the_same_order` — MySQL duplicate FKs deterministically pick same one across ten introspections [connectors: tags(Mysql) exclude(Vitess)]

### schema-engine/sql-introspection-tests/tests/relations/postgres.rs

- [ ] `relations::postgres::kanjis` — Kanji column and constraint names are sanitized and mapped in relations [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `relations::postgres::multiple_foreign_key_constraints_are_taken_always_in_the_same_order` — Postgres duplicate FKs deterministically pick same one across ten introspections [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `relations::postgres::relations_should_avoid_name_clashes_2` — Postgres compound-FK relations avoid name clashes with disambiguated names [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `relations::postgres::default_values_on_relations` — FK column with a default value keeps the default in relation [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `relations::postgres::name_ambiguity_with_a_scalar_field` — Relation field disambiguated when it collides with a scalar field name [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `relations::postgres::legacy_prisma_many_to_many_relation` — Legacy implicit _PostToUser join table introspects as m-n lists [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `relations::postgres::new_prisma_many_to_many_relation` — New implicit join table with composite primary key introspects as m-n [connectors: tags(Postgres) exclude(CockroachDb)]

### schema-engine/sql-introspection-tests/tests/relations/sqlite.rs

- [ ] `relations::sqlite::a_many_to_many_relation_with_an_id` — SQLite join table with id becomes model with relations [connectors: tags(Sqlite)]
- [ ] `relations::sqlite::a_one_to_one_relation_referencing_non_id` — SQLite 1-1 relation referencing non-id unique column with autoindex [connectors: tags(Sqlite)]
- [ ] `relations::sqlite::relations_should_avoid_name_clashes` — SQLite relation field names avoid clashing with scalar columns [connectors: tags(Sqlite)]
- [ ] `relations::sqlite::a_one_to_one_relation` — SQLite nullable unique FK produces optional 1-1 relation [connectors: tags(Sqlite)]
- [ ] `relations::sqlite::one_to_one_req_relation` — SQLite required 1-1 FK on unique column with autoindex [connectors: tags(Sqlite)]
- [ ] `relations::sqlite::two_one_to_one_relations_between_the_same_models` — SQLite two 1-1 relations between same models get disambiguated names [connectors: tags(Sqlite)]
- [ ] `relations::sqlite::one_to_one_relation_on_a_singular_primary_key` — SQLite 1-1 relation where FK is unique primary key [connectors: tags(Sqlite)]
- [ ] `relations::sqlite::multiple_foreign_key_constraints_are_taken_always_in_the_same_order` — SQLite duplicate FKs collapse into one relation with onUpdate [connectors: tags(Sqlite)]
- [ ] `relations::sqlite::a_self_relation` — SQLite two self-referencing FKs produce named self-relations [connectors: tags(Sqlite)]
- [ ] `relations::sqlite::a_one_to_many_relation` — SQLite nullable FK yields optional many-side with list back-relation [connectors: tags(Sqlite)]
- [ ] `relations::sqlite::relations_should_avoid_name_clashes_2` — SQLite compound-FK relations avoid name clashes with disambiguated names [connectors: tags(Sqlite)]

### schema-engine/sql-introspection-tests/tests/relations_with_compound_fk/cockroachdb.rs

- [ ] `relations_with_compound_fk::cockroachdb::compound_foreign_keys_with_defaults_v_22_1` — CockroachDB 22.1 compound self-relation FK with defaults introspects sequence id and @relation [connectors: tags(CockroachDb221)]
- [ ] `relations_with_compound_fk::cockroachdb::compound_foreign_keys_with_defaults_v_22_2` — CockroachDB 22.2 compound self-relation FK with defaults introspects sequence maxValue and @relation [connectors: tags(CockroachDb222)]

### schema-engine/sql-introspection-tests/tests/relations_with_compound_fk/mod.rs

- [ ] `relations_with_compound_fk::compound_foreign_keys_for_one_to_one_relations` — Compound FK plus unique on FK columns introspects optional one-to-one @relation [connectors: exclude(Sqlite, Mysql, CockroachDb)]
- [ ] `relations_with_compound_fk::compound_foreign_keys_for_required_one_to_many_relations` — Required compound FK to unique introspects required one-to-many @relation [connectors: exclude(Mysql, Mssql, CockroachDb)]
- [ ] `relations_with_compound_fk::compound_foreign_keys_for_required_self_relations` — Required compound self-referencing FK introspects named required self-relation with map [connectors: exclude(Sqlite, Mysql, Mssql, CockroachDb)]
- [ ] `relations_with_compound_fk::compound_foreign_keys_for_self_relations` — Nullable compound self-referencing FK introspects named optional self-relation with map [connectors: exclude(Mysql, Sqlite, CockroachDb)]
- [ ] `relations_with_compound_fk::repro_matt_references_on_wrong_side` — Compound FK referencing another table's compound primary key introspects correct relation direction [connectors: exclude(Mysql, Mssql, CockroachDb)]
- [ ] `relations_with_compound_fk::a_compound_fk_pk_with_overlapping_primary_key` — Compound FK overlapping the compound primary key introspects @relation with @@id [connectors: exclude(Mysql, Mssql, CockroachDb)]
- [ ] `relations_with_compound_fk::compound_foreign_keys_for_duplicate_one_to_many_relations` — Two compound FKs to same table produce disambiguated named one-to-many relations [connectors: exclude(Mysql, Sqlite, CockroachDb)]

### schema-engine/sql-introspection-tests/tests/relations_with_compound_fk/mssql.rs

- [ ] `relations_with_compound_fk::mssql::compound_foreign_keys_for_required_one_to_one_relations` — Required compound FK plus unique introspects required one-to-one @relation [connectors: tags(Mssql)]
- [ ] `relations_with_compound_fk::mssql::a_compound_fk_pk_with_overlapping_primary_key` — Compound FK overlapping the compound primary key introspects @relation with @@id [connectors: tags(Mssql)]
- [ ] `relations_with_compound_fk::mssql::compound_foreign_keys_for_one_to_many_relations_with_mixed_requiredness` — Compound FK with mixed requiredness stays optional one-to-many with mapped name [connectors: tags(Mssql)]
- [ ] `relations_with_compound_fk::mssql::compound_foreign_keys_for_required_one_to_many_relations` — Required compound FK to unique introspects required one-to-many @relation [connectors: tags(Mssql)]
- [ ] `relations_with_compound_fk::mssql::repro_matt_references_on_wrong_side` — Compound FK referencing another table's compound primary key introspects correct relation direction [connectors: tags(Mssql)]
- [ ] `relations_with_compound_fk::mssql::compound_foreign_keys_for_one_to_many_relations_with_non_unique_index` — Required compound FK to unique constraint introspects required one-to-many with mapped name [connectors: tags(Mssql)]
- [ ] `relations_with_compound_fk::mssql::compound_foreign_keys_for_required_self_relations` — Required compound self-referencing FK introspects named required self-relation with map [connectors: tags(Mssql)]
- [ ] `relations_with_compound_fk::mssql::compound_foreign_keys_with_defaults` — Compound self-relation FK columns with named defaults introspect @default plus @relation [connectors: tags(Mssql)]
- [ ] `relations_with_compound_fk::mssql::compound_foreign_keys_for_one_to_many_relations` — Nullable compound FK to unique introspects optional one-to-many @relation with mapped name [connectors: tags(Mssql)]

### schema-engine/sql-introspection-tests/tests/relations_with_compound_fk/mysql.rs

- [ ] `relations_with_compound_fk::mysql::a_compound_fk_pk_with_overlapping_primary_key` — Compound FK overlapping the compound primary key introspects @relation with @@id/@@index [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `relations_with_compound_fk::mysql::compound_foreign_keys_for_duplicate_one_to_many_relations` — Two compound FKs to same table produce disambiguated named one-to-many relations [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `relations_with_compound_fk::mysql::compound_foreign_keys_for_one_to_many_relations` — Compound FK to unique columns introspects optional one-to-many @relation with fields/references [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `relations_with_compound_fk::mysql::compound_foreign_keys_for_one_to_many_relations_with_mixed_requiredness` — Compound FK with one required, one nullable column stays optional one-to-many relation [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `relations_with_compound_fk::mysql::compound_foreign_keys_for_one_to_many_relations_with_non_unique_index` — Required compound FK to unique constraint introspects required one-to-many @relation [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `relations_with_compound_fk::mysql::compound_foreign_keys_for_one_to_one_relations` — Compound FK plus unique on FK columns introspects optional one-to-one @relation [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `relations_with_compound_fk::mysql::compound_foreign_keys_for_required_one_to_one_relations` — Required compound FK plus unique introspects required one-to-one @relation [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `relations_with_compound_fk::mysql::compound_foreign_keys_for_required_one_to_many_relations` — Required compound FK to unique introspects required one-to-many @relation [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `relations_with_compound_fk::mysql::compound_foreign_keys_for_required_self_relations` — Required compound self-referencing FK introspects named required self-relation [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `relations_with_compound_fk::mysql::compound_foreign_keys_for_self_relations` — Nullable compound self-referencing FK introspects named optional self-relation [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `relations_with_compound_fk::mysql::compound_foreign_keys_with_defaults` — Compound self-relation FK columns with defaults introspect @default plus @relation [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `relations_with_compound_fk::mysql::repro_matt_references_on_wrong_side` — Compound FK referencing another table's compound primary key introspects correct relation direction [connectors: tags(Mysql) exclude(Vitess)]

### schema-engine/sql-introspection-tests/tests/relations_with_compound_fk/postgres.rs

- [ ] `relations_with_compound_fk::postgres::compound_foreign_keys_for_one_to_many_relations` — Nullable compound FK to unique introspects optional one-to-many @relation with mapped name [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `relations_with_compound_fk::postgres::compound_foreign_keys_for_required_one_to_one_relations` — Required compound FK plus unique introspects required one-to-one @relation [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `relations_with_compound_fk::postgres::compound_foreign_keys_for_one_to_many_relations_with_non_unique_index` — Required compound FK to unique constraint introspects required one-to-many @relation [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `relations_with_compound_fk::postgres::compound_foreign_keys_for_one_to_many_relations_with_mixed_requiredness` — Compound FK with mixed requiredness stays optional one-to-many with mapped name [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `relations_with_compound_fk::postgres::compound_foreign_keys_with_defaults` — Compound self-relation FK columns with defaults introspect @default plus @relation [connectors: tags(Postgres) exclude(CockroachDb)]

### schema-engine/sql-introspection-tests/tests/relations_with_compound_fk/sqlite.rs

- [ ] `relations_with_compound_fk::sqlite::compound_foreign_keys_for_duplicate_one_to_many_relations` — Two compound FKs to same table produce disambiguated named one-to-many relations [connectors: tags(Sqlite)]
- [ ] `relations_with_compound_fk::sqlite::compound_foreign_keys_for_one_to_many_relations_with_non_unique_index` — Required compound FK to unique constraint introspects required one-to-many @relation [connectors: tags(Sqlite)]
- [ ] `relations_with_compound_fk::sqlite::compound_foreign_keys_for_one_to_one_relations` — Compound FK plus unique on FK columns introspects optional one-to-one @relation [connectors: tags(Sqlite)]
- [ ] `relations_with_compound_fk::sqlite::compound_foreign_keys_for_required_one_to_one_relations` — Required compound FK plus unique introspects required one-to-one @relation [connectors: tags(Sqlite)]
- [ ] `relations_with_compound_fk::sqlite::compound_foreign_keys_for_required_self_relations` — Required compound self-referencing FK introspects named required self-relation [connectors: tags(Sqlite)]
- [ ] `relations_with_compound_fk::sqlite::compound_foreign_keys_for_self_relations` — Nullable compound self-referencing FK introspects named optional self-relation [connectors: tags(Sqlite)]
- [ ] `relations_with_compound_fk::sqlite::compound_foreign_keys_with_defaults` — Compound self-relation FK columns with defaults introspect @default plus @relation [connectors: tags(Sqlite)]
- [ ] `relations_with_compound_fk::sqlite::compound_foreign_keys_for_one_to_many_relations` — Compound FK to unique columns introspects optional one-to-many @relation with fields/references [connectors: tags(Sqlite)]
- [ ] `relations_with_compound_fk::sqlite::compound_foreign_keys_for_one_to_many_relations_with_mixed_requiredness` — Compound FK with one required, one nullable column stays optional one-to-many relation [connectors: tags(Sqlite)]

### schema-engine/sql-introspection-tests/tests/remapping_database_names/mod.rs

- [ ] `remapping_database_names::remapping_fields_with_invalid_characters` — Columns with invalid characters sanitized and remapped via @map. [connectors: exclude(CockroachDb)]
- [ ] `remapping_database_names::remapping_tables_with_invalid_characters` — Tables with invalid characters sanitized and remapped via @@map. [connectors: exclude(CockroachDb)]
- [ ] `remapping_database_names::remapping_models_in_relations` — Related model with invalid name remapped via @@map and referenced in relations. [connectors: exclude(Mssql, Sqlite, Vitess, CockroachDb)]
- [ ] `remapping_database_names::remapping_models_in_relations_should_not_map_virtual_fields` — Model @@map does not add @map to virtual relation fields. [connectors: exclude(Mssql, Sqlite, Vitess, CockroachDb)]
- [ ] `remapping_database_names::remapping_fields_in_compound_relations` — Invalid field names in compound FK sanitized and remapped via @map. [connectors: exclude(Sqlite, Mssql, Vitess, CockroachDb)]
- [ ] `remapping_database_names::remapping_enum_values` — Enum values with invalid characters sanitized and remapped via @map. [connectors: exclude(CockroachDb, Sqlite) capabilities(Enums)]
- [ ] `remapping_database_names::remapping_enum_default_values` — Remapped enum default value sanitized and referenced in @default. [connectors: exclude(CockroachDb, Sqlite) capabilities(Enums)]
- [ ] `remapping_database_names::remapping_compound_primary_keys` — Compound primary key field with invalid name remapped via @map. [connectors: (none)]
- [ ] `remapping_database_names::not_automatically_remapping_invalid_compound_unique_key_names` — Invalid compound unique index name kept verbatim in @@unique map. [connectors: exclude(CockroachDb)]
- [ ] `remapping_database_names::not_automatically_remapping_invalid_compound_primary_key_names` — Invalid compound primary key name kept verbatim in @@id map. [connectors: (none)]

### schema-engine/sql-introspection-tests/tests/remapping_database_names/mssql.rs

- [ ] `remapping_database_names::mssql::remapping_models_in_relations_should_not_map_virtual_fields` — SQL Server model @@map does not add @map to virtual relation fields. [connectors: tags(Mssql)]
- [ ] `remapping_database_names::mssql::remapping_models_in_relations` — SQL Server related model with invalid name remapped via @@map in relations. [connectors: tags(Mssql)]
- [ ] `remapping_database_names::mssql::remapping_fields_in_compound_relations` — SQL Server invalid compound-relation field names sanitized and remapped via @map. [connectors: tags(Mssql)]

### schema-engine/sql-introspection-tests/tests/remapping_database_names/mysql.rs

- [ ] `remapping_database_names::mysql::remapping_enum_names` — MySQL enum and table with invalid names sanitized and remapped via @@map. [connectors: tags(Mysql) exclude(Vitess)]

### schema-engine/sql-introspection-tests/tests/remapping_database_names/postgresql.rs

- [ ] `remapping_database_names::postgresql::remapping_enum_names` — Postgres enum and table with invalid names sanitized and remapped via @@map. [connectors: tags(Postgres) exclude(CockroachDb)]

### schema-engine/sql-introspection-tests/tests/remapping_database_names/sqlite.rs

- [ ] `remapping_database_names::sqlite::remapping_models_in_compound_relations` — SQLite model with invalid name remapped via @@map in compound relation. [connectors: tags(Sqlite)]
- [ ] `remapping_database_names::sqlite::remapping_models_in_relations` — SQLite related model with invalid name remapped via @@map in relations. [connectors: tags(Sqlite)]
- [ ] `remapping_database_names::sqlite::remapping_models_in_relations_should_not_map_virtual_fields` — SQLite model @@map does not add @map to virtual relation fields. [connectors: tags(Sqlite)]

### schema-engine/sql-introspection-tests/tests/simple/

- [ ] `schema-engine/sql-introspection-tests/tests/simple/cockroach/foreign_keys_duplicates_should_be_ignored.sql` — Duplicate foreign keys on CockroachDB are collapsed/ignored during introspection [connectors: tags=cockroachdb]
- [ ] `schema-engine/sql-introspection-tests/tests/simple/cockroach/index_with_expression_column.sql` — CockroachDB index containing an expression column is handled/skipped [connectors: tags=cockroachdb]
- [ ] `schema-engine/sql-introspection-tests/tests/simple/cockroach/partial_unique_index.sql` — CockroachDB partial unique index introspects with its where predicate [connectors: tags=cockroachdb]
- [ ] `schema-engine/sql-introspection-tests/tests/simple/cockroach/views/defaults_are_introspected.sql` — CockroachDB view column defaults are introspected (views preview feature) [connectors: preview_features=views tags=cockroachdb]
- [ ] `schema-engine/sql-introspection-tests/tests/simple/cockroach/views/preview_feature_is_required.sql` — CockroachDB view omitted without the views preview feature [connectors: tags=cockroachdb]
- [ ] `schema-engine/sql-introspection-tests/tests/simple/cockroach/views/schema_is_introspected.sql` — CockroachDB view in a named schema is introspected with its schema [connectors: preview_features=views schemas=public tags=cockroachdb]
- [ ] `schema-engine/sql-introspection-tests/tests/simple/cockroach/views/simple_view_from_one_table.sql` — CockroachDB view over one table becomes a view block [connectors: preview_features=views tags=cockroachdb]
- [ ] `schema-engine/sql-introspection-tests/tests/simple/cockroach/views/simple_view_from_two_tables.sql` — CockroachDB view joining two tables introspects joined columns [connectors: preview_features=views tags=cockroachdb]
- [ ] `schema-engine/sql-introspection-tests/tests/simple/mssql/composite_primary_key.sql` — SQL Server composite primary key introspects as @@id [connectors: tags=mssql]
- [ ] `schema-engine/sql-introspection-tests/tests/simple/mssql/default_with_create_default.sql` — SQL Server CREATE DEFAULT bound object introspects as @default [connectors: tags=mssql2017]
- [ ] `schema-engine/sql-introspection-tests/tests/simple/mssql/default_with_create_default_multiline.sql` — SQL Server multiline CREATE DEFAULT bound object introspects as @default [connectors: tags=mssql2017]
- [ ] `schema-engine/sql-introspection-tests/tests/simple/mssql/geometry_should_be_unsupported.sql` — SQL Server geometry column introspects as Unsupported [connectors: tags=mssql]
- [ ] `schema-engine/sql-introspection-tests/tests/simple/mssql/index_included_columns_should_not_be_introspected.sql` — SQL Server index INCLUDE columns are not introspected [connectors: tags=mssql]
- [ ] `schema-engine/sql-introspection-tests/tests/simple/mssql/partial_unique_index.sql` — SQL Server filtered/partial unique index introspects with where predicate [connectors: tags=mssql]
- [ ] `schema-engine/sql-introspection-tests/tests/simple/mssql/referential_actions.sql` — SQL Server referential actions (onDelete/onUpdate) are introspected [connectors: tags=mssql]
- [ ] `schema-engine/sql-introspection-tests/tests/simple/mssql/referential_actions_default_for_optional_fields.sql` — SQL Server default referential actions for optional FK fields [connectors: tags=mssql]
- [ ] `schema-engine/sql-introspection-tests/tests/simple/mssql/referential_actions_without_restrict.sql` — SQL Server referential actions without Restrict are introspected [connectors: tags=mssql]
- [ ] `schema-engine/sql-introspection-tests/tests/simple/mysql/expression_indices.sql` — MySQL 8 expression indices are handled/skipped during introspection [connectors: tags=mysql8 exclude=vitess]
- [ ] `schema-engine/sql-introspection-tests/tests/simple/mysql/ignore/relation_with_ignored_referenced_table.sql` — MySQL relation to an ignored referenced table gets @ignore handling [connectors: tags=mysql exclude=vitess]
- [ ] `schema-engine/sql-introspection-tests/tests/simple/mysql/many_to_many_relation_field_names_conflict.sql` — MySQL m-n relation field names that conflict are disambiguated [connectors: tags=mysql exclude=vitess]
- [ ] `schema-engine/sql-introspection-tests/tests/simple/mysql/quoted_enum_values.sql` — MySQL inline enum with quoted values is introspected [connectors: tags=mysql exclude=vitess]
- [ ] `schema-engine/sql-introspection-tests/tests/simple/mysql/views/enums_in_views_no_preview.sql` — MySQL view with enum columns without views preview feature [connectors: tags=mysql exclude=vitess]
- [ ] `schema-engine/sql-introspection-tests/tests/simple/postgres/a_table_with_reserved_name.sql` — Postgres table with a reserved name is renamed with @@map [connectors: tags=postgres exclude=cockroachdb]
- [ ] `schema-engine/sql-introspection-tests/tests/simple/postgres/index_with_expression_column.sql` — Postgres index with an expression column is handled/skipped [connectors: tags=postgres exclude=cockroachdb]
- [ ] `schema-engine/sql-introspection-tests/tests/simple/postgres/int_array_extension_does_not_conflict.sql` — Postgres int array with extension does not cause a naming conflict [connectors: tags=postgres exclude=cockroachdb]
- [ ] `schema-engine/sql-introspection-tests/tests/simple/postgres/many_to_many_relation_field_names_do_not_conflict_with_themselves.sql` — Postgres self m-n relation field names do not conflict with themselves [connectors: tags=postgres exclude=cockroachdb]
- [ ] `schema-engine/sql-introspection-tests/tests/simple/postgres/multiple_single_field_unique_indexes.sql` — Postgres multiple single-field unique indexes each introspect as @unique [connectors: tags=postgres exclude=cockroachdb]
- [ ] `schema-engine/sql-introspection-tests/tests/simple/postgres/partial_unique_index.sql` — Postgres partial unique index introspects with its where predicate [connectors: tags=postgres exclude=cockroachdb]
- [ ] `schema-engine/sql-introspection-tests/tests/simple/postgres/relations/inline_self_relation.sql` — Postgres inline self-relation is introspected [connectors: tags=postgres exclude=cockroachdb]
- [ ] `schema-engine/sql-introspection-tests/tests/simple/postgres/relations/many_to_many_relation.sql` — Postgres implicit m-n join table introspects as m-n relation [connectors: tags=postgres exclude=cockroachdb]
- [ ] `schema-engine/sql-introspection-tests/tests/simple/postgres/strings_with_quotes_render_as_escaped_literals.sql` — Postgres string defaults with quotes render as escaped literals [connectors: tags=postgres exclude=cockroachdb]
- [ ] `schema-engine/sql-introspection-tests/tests/simple/sqlite/partial_unique_index.sql` — SQLite partial unique index introspects with its where predicate [connectors: tags=sqlite]
- [ ] `schema-engine/sql-introspection-tests/tests/simple/sqlite/views/simple.sql` — SQLite simple view introspects as a view block (views preview feature) [connectors: preview_features=views tags=sqlite]

### schema-engine/sql-introspection-tests/tests/tables/cockroachdb.rs

- [ ] `tables::cockroachdb::negative_default_values_should_work` — CockroachDB negative int, float, and bigint defaults introspect correctly with native types. [connectors: tags(CockroachDb)]
- [ ] `tables::cockroachdb::should_ignore_prisma_helper_tables` — CockroachDB Prisma helper tables are excluded from the datamodel. [connectors: tags(CockroachDb)]
- [ ] `tables::cockroachdb::default_values` — CockroachDB static and current_timestamp defaults introspect with native types. [connectors: tags(CockroachDb)]
- [ ] `tables::cockroachdb::a_simple_table_with_gql_types` — CockroachDB basic column types introspect to correct scalar and native types. [connectors: tags(CockroachDb)]
- [ ] `tables::cockroachdb::introspecting_a_table_with_json_type_must_work_cockroach` — CockroachDB JSON column introspects as Json field. [connectors: tags(CockroachDb)]
- [ ] `tables::cockroachdb::a_table_with_non_id_autoincrement_cockroach` — CockroachDB non-id serial unique column introspects as BigInt @unique autoincrement. [connectors: tags(CockroachDb)]
- [ ] `tables::cockroachdb::introspecting_json_defaults_on_cockroach` — CockroachDB JSON/JSONB column defaults introspect as escaped string defaults. [connectors: tags(CockroachDb)]
- [ ] `tables::cockroachdb::string_defaults_that_need_escaping` — CockroachDB text default with special characters introspects with proper escaping. [connectors: tags(CockroachDb)]
- [ ] `tables::cockroachdb::datetime_default_expressions_are_not_truncated` — CockroachDB now()+interval default expression introspects fully as dbgenerated. [connectors: tags(CockroachDb)]
- [ ] `tables::cockroachdb::northwind` — Full CockroachDB Northwind schema introspects to expected relational datamodel. [connectors: tags(CockroachDb)]

### schema-engine/sql-introspection-tests/tests/tables/mod.rs

- [ ] `tables::nul_default_bytes` — MySQL BINARY column with null-byte default introspects as Bytes with dbgenerated default. [connectors: tags(Mysql57)]
- [ ] `tables::a_simple_table_with_gql_types` — Basic column types introspect to correct Prisma scalar and native types. [connectors: exclude(CockroachDb)]
- [ ] `tables::should_ignore_prisma_helper_tables` — Prisma helper tables (_RelayId, _Migration, _prisma_migrations) are excluded from the datamodel. [connectors: exclude(CockroachDb)]
- [ ] `tables::a_table_with_compound_primary_keys` — Multi-column primary key introspects as a block-level @@id. [connectors: (none)]
- [ ] `tables::a_table_with_unique_index` — Single-column unique index introspects as @unique with its map name. [connectors: exclude(CockroachDb)]
- [ ] `tables::a_table_with_multi_column_unique_index` — Multi-column unique index introspects as block-level @@unique with map name. [connectors: exclude(CockroachDb)]
- [ ] `tables::a_table_with_required_and_optional_columns` — Nullable columns introspect as optional, non-null columns as required. [connectors: exclude(CockroachDb)]
- [ ] `tables::a_table_with_default_values` — Boolean, float, int, and string column defaults introspect with native types. [connectors: exclude(Mssql, CockroachDb)]
- [ ] `tables::a_table_with_a_non_unique_index` — Single-column non-unique index introspects as block-level @@index. [connectors: exclude(CockroachDb)]
- [ ] `tables::a_table_with_a_multi_column_non_unique_index` — Multi-column non-unique index introspects as block-level @@index. [connectors: exclude(CockroachDb)]
- [ ] `tables::a_table_with_non_id_autoincrement` — Serial non-id unique column introspects as @unique with autoincrement default. [connectors: exclude(Sqlite, Mysql, CockroachDb)]
- [ ] `tables::default_values` — Various static and now() column defaults introspect with native types. [connectors: exclude(Mssql, CockroachDb)]
- [ ] `tables::pg_default_value_as_dbgenerated` — Postgres function/sequence defaults introspect as dbgenerated or autoincrement. [connectors: tags(Postgres) exclude(CockroachDb, Postgres14, Postgres15, Postgres16)]
- [ ] `tables::pg14_default_value_as_dbgenerated` — Postgres 14 EXTRACT and other defaults introspect as dbgenerated/autoincrement. [connectors: tags(Postgres14)]
- [ ] `tables::my_default_value_as_dbgenerated` — MySQL CURRENT_TIMESTAMP defaults introspect as now() with Timestamp native type. [connectors: tags(Mysql)]
- [ ] `tables::a_table_with_an_index_that_contains_expressions_should_be_ignored` — MySQL index containing expressions is ignored during introspection. [connectors: tags(Mysql8)]
- [ ] `tables::a_table_with_partial_indexes_should_introspect_them` — Postgres partial unique indexes introspect with where predicate and partialIndexes feature. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `tables::a_table_with_partial_indexes_should_introspect_them_sqlite` — SQLite partial unique indexes introspect with where predicate and partialIndexes feature. [connectors: tags(Sqlite)]
- [ ] `tables::different_default_values_should_work` — MariaDB tinytext string vs numeric defaults introspect as literal or dbgenerated. [connectors: tags(Mariadb)]
- [ ] `tables::negative_default_values_should_work` — Negative int, float, and bigint defaults introspect correctly with sign. [connectors: exclude(Sqlite, Mssql, CockroachDb)]
- [ ] `tables::expression_indexes_should_be_ignored_on_sqlite` — SQLite expression index (LOWER) is ignored during introspection. [connectors: tags(Sqlite)]
- [ ] `tables::casing_should_not_lead_to_mix_ups` — MySQL tables differing only by case introspect as distinct models. [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `tables::unique_and_index_on_same_field_works_mysql` — MySQL serial primary key introspects as @id @unique with autoincrement. [connectors: tags(Mysql) exclude(Mariadb)]
- [ ] `tables::unique_and_index_on_same_field_works_mariadb` — MariaDB pk with separate unique constraint introspects as @id @unique with map. [connectors: tags(Mariadb)]
- [ ] `tables::unique_and_id_on_same_field_works_sqlite` — SQLite pk with unique introspects as @id @unique with autoindex map. [connectors: tags(Sqlite)]
- [ ] `tables::unique_and_id_on_same_field_works_mssql` — MSSQL identity pk with unique constraint introspects as @id @unique autoincrement. [connectors: tags(Mssql)]
- [ ] `tables::unique_and_index_on_same_field_works_postgres` — Postgres collapses duplicate constraints; later-added unique persists as separate @unique. [connectors: tags(Postgres) exclude(CockroachDb)]

### schema-engine/sql-introspection-tests/tests/tables/mssql.rs

- [ ] `tables::mssql::default_values` — MSSQL named constraint defaults introspect with default value and map name. [connectors: tags(Mssql)]
- [ ] `tables::mssql::negative_default_values_should_work` — MSSQL negative int, float, and bigint defaults introspect with map names. [connectors: tags(Mssql)]
- [ ] `tables::mssql::a_table_with_descending_primary_key` — MSSQL descending primary key introspects with sort: Desc on @id. [connectors: tags(Mssql)]
- [ ] `tables::mssql::a_table_with_descending_unique` — MSSQL descending unique constraint introspects with sort: Desc on @unique. [connectors: tags(Mssql)]
- [ ] `tables::mssql::a_table_with_descending_compound_unique` — MSSQL descending compound unique introspects with per-column sort in @@unique. [connectors: tags(Mssql)]
- [ ] `tables::mssql::a_table_with_descending_index` — MSSQL descending compound index introspects with per-column sort in @@index. [connectors: tags(Mssql)]

### schema-engine/sql-introspection-tests/tests/tables/mysql.rs

- [ ] `tables::mysql::a_table_with_non_id_autoincrement` — MySQL non-id auto_increment unique column introspects as @unique with autoincrement default. [connectors: tags(Mysql)]
- [ ] `tables::mysql::a_table_with_length_prefixed_primary_key` — MySQL length-prefixed TEXT primary key introspects as @id with length argument. [connectors: tags(Mysql8)]
- [ ] `tables::mysql::a_table_with_length_prefixed_unique` — MySQL length-prefixed unique constraint introspects as @unique with length argument. [connectors: tags(Mysql8)]
- [ ] `tables::mysql::a_table_with_length_prefixed_compound_unique` — MySQL length-prefixed compound unique introspects as @@unique with per-column lengths. [connectors: tags(Mysql8)]
- [ ] `tables::mysql::a_table_with_length_prefixed_index` — MySQL length-prefixed compound index introspects as @@index with per-column lengths. [connectors: tags(Mysql8)]
- [ ] `tables::mysql::a_table_with_non_length_prefixed_index` — MySQL mixed plain and length-prefixed indexes introspect with correct length args. [connectors: tags(Mysql8)]
- [ ] `tables::mysql::a_table_with_descending_index` — MySQL descending index column introspects with sort: Desc in @@index. [connectors: tags(Mysql8)]
- [ ] `tables::mysql::a_table_with_descending_unique` — MySQL descending unique index column introspects with sort: Desc in @@unique. [connectors: tags(Mysql8)]
- [ ] `tables::mysql::a_table_with_fulltext_index` — MySQL fulltext index introspects as @@fulltext block attribute. [connectors: tags(Mysql)]
- [ ] `tables::mysql::a_table_with_fulltext_index_with_custom_name` — MySQL named fulltext index introspects as @@fulltext with map name. [connectors: tags(Mysql)]
- [ ] `tables::mysql::date_time_defaults` — MySQL date/datetime/time literal defaults introspect as dbgenerated with native types. [connectors: tags(Mysql) exclude(Mariadb)]
- [ ] `tables::mysql::date_time_defaults_mariadb` — MariaDB date/datetime/time literal defaults introspect as parenthesized dbgenerated. [connectors: tags(Mariadb)]
- [ ] `tables::mysql::missing_select_rights` — Introspection with a user lacking select rights returns empty result. [connectors: tags(Mysql8) exclude(Vitess)]
- [ ] `tables::mysql::northwind` — Full MySQL Northwind schema introspects to expected relational datamodel. [connectors: tags(Mysql) exclude(Vitess)]
- [ ] `tables::mysql::commenting_stopgap` — MySQL table/column comments produce doc comment and warnings, unsupported stopgap. [connectors: tags(Mysql8) exclude(Vitess)]

### schema-engine/sql-introspection-tests/tests/tables/postgres.rs

- [ ] `tables::postgres::string_defaults_that_need_escaping` — Postgres text default with special characters introspects with proper escaping. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `tables::postgres::a_table_with_descending_unique` — Postgres descending unique index introspects with sort: Desc on @unique. [connectors: tags(Postgres)]
- [ ] `tables::postgres::a_table_with_descending_compound_unique` — Postgres descending compound unique introspects with per-column sort in @@unique. [connectors: tags(Postgres)]
- [ ] `tables::postgres::a_table_with_descending_index` — Postgres descending compound index introspects with per-column sort in @@index. [connectors: tags(Postgres)]
- [ ] `tables::postgres::a_table_with_a_hash_index` — Postgres hash index introspects with type: Hash in @@index. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `tables::postgres::introspecting_now_functions` — Postgres now() and current_timestamp defaults introspect as now() across date types. [connectors: tags(Postgres)]
- [ ] `tables::postgres::a_table_with_json_columns` — Postgres JSONB default with embedded quote introspects with proper escaping. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `tables::postgres::datetime_default_expressions_are_not_truncated` — Postgres now()+interval default expression introspects fully as dbgenerated. [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `tables::postgres::northwind` — Full Postgres Northwind schema introspects to expected relational datamodel. [connectors: tags(Postgres12, Postgres14) exclude(CockroachDb)]

### schema-engine/sql-introspection-tests/tests/tables/sqlite.rs

- [ ] `tables::sqlite::a_table_with_descending_unique` — SQLite descending unique index introspects with sort: Desc on @unique. [connectors: tags(Sqlite)]
- [ ] `tables::sqlite::a_table_with_descending_compound_unique` — SQLite descending compound unique introspects with per-column sort in @@unique. [connectors: tags(Sqlite)]
- [ ] `tables::sqlite::a_table_with_descending_index` — SQLite descending compound index introspects with per-column sort in @@index. [connectors: tags(Sqlite)]

### schema-engine/sql-introspection-tests/tests/views/mysql.rs

- [ ] `views::mysql::simple_view_from_one_table` — View over one table becomes a view block with mapped types [connectors: tags(Mysql) exclude(Vitess) preview_features("views")]
- [ ] `views::mysql::simple_view_from_two_tables` — View joining two tables introspects computed and joined columns [connectors: tags(Mysql) exclude(Vitess, Mariadb) preview_features("views")]
- [ ] `views::mysql::re_intro_keeps_view_to_view_relations` — Re-introspection preserves view-to-view relations, adding zero defaults [connectors: tags(Mysql) exclude(Vitess) preview_features("views")]
- [ ] `views::mysql::defaults_are_introspected` — View column defaults are introspected as @default [connectors: tags(Mysql) exclude(Vitess) preview_features("views")]
- [ ] `views::mysql::views_are_rendered_with_enums` — View columns backed by enums render enum types [connectors: tags(Mysql8) exclude(Vitess) preview_features("views")]
- [ ] `views::mysql::invalid_field_names_trigger_warnings` — Invalid view and table field names are commented out with warnings [connectors: tags(Mysql8) exclude(Vitess) preview_features("views")]

### schema-engine/sql-introspection-tests/tests/views/postgresql.rs

- [ ] `views::postgresql::preview_feature_is_required` — Without views preview feature, view is omitted from introspected schema [connectors: tags(Postgres) exclude(CockroachDb)]
- [ ] `views::postgresql::simple_view_from_one_table` — View over one table becomes a view block with nullable columns [connectors: tags(Postgres) exclude(Postgres16, CockroachDb) preview_features("views")]
- [ ] `views::postgresql::simple_view_from_one_table_postgres16` — Postgres 16 renders unqualified column names in view definition [connectors: tags(Postgres16) preview_features("views")]
- [ ] `views::postgresql::simple_view_from_two_tables` — View joining two tables introspects computed and joined columns [connectors: tags(Postgres) exclude(CockroachDb) preview_features("views")]
- [ ] `views::postgresql::re_intro_keeps_column_arity_and_unique` — Re-introspection preserves existing view column arity and uniqueness [connectors: tags(Postgres) exclude(CockroachDb) preview_features("views")]
- [ ] `views::postgresql::re_intro_does_not_keep_column_arity_if_list` — Re-introspection overrides scalar arity when database column is a list [connectors: tags(Postgres) exclude(CockroachDb) preview_features("views")]
- [ ] `views::postgresql::re_intro_keeps_back_relations` — Re-introspection preserves back-relation fields on views [connectors: tags(Postgres) exclude(CockroachDb) preview_features("views")]
- [ ] `views::postgresql::re_intro_keeps_forward_relations` — Re-introspection preserves forward-relation fields on views [connectors: tags(Postgres) exclude(CockroachDb) preview_features("views")]
- [ ] `views::postgresql::re_intro_keeps_view_to_view_relations` — Re-introspection preserves relations defined between two views [connectors: tags(Postgres) exclude(CockroachDb) preview_features("views")]
- [ ] `views::postgresql::re_intro_keeps_comments` — Re-introspection preserves view-level and field-level doc comments [connectors: tags(Postgres) exclude(CockroachDb) preview_features("views")]
- [ ] `views::postgresql::re_intro_ignores_the_ignored` — Re-introspection preserves @@ignore attribute on views [connectors: tags(Postgres) exclude(CockroachDb) preview_features("views")]
- [ ] `views::postgresql::reserved_name_gets_mapped` — View named with reserved keyword is renamed and mapped [connectors: tags(Postgres) exclude(CockroachDb) preview_features("views")]
- [ ] `views::postgresql::unsupported_types_trigger_a_warning` — Unsupported view column types become Unsupported and trigger warning [connectors: tags(Postgres) exclude(CockroachDb) preview_features("views")]
- [ ] `views::postgresql::re_intro_keeps_the_map` — Re-introspection preserves @@map on views and warns [connectors: tags(Postgres) exclude(CockroachDb) preview_features("views")]
- [ ] `views::postgresql::re_intro_keeps_the_field_map` — Re-introspection preserves field @map on view fields and warns [connectors: tags(Postgres) exclude(CockroachDb) preview_features("views")]
- [ ] `views::postgresql::schema_is_introspected` — View in named schema gets @@schema and definition [connectors: tags(Postgres) exclude(CockroachDb) preview_features("views") namespaces("public")]
- [ ] `views::postgresql::defaults_are_introspected` — View column defaults are introspected as @default [connectors: tags(Postgres) exclude(CockroachDb) preview_features("views")]
- [ ] `views::postgresql::invalid_field_names_trigger_warnings` — Invalid view field names are commented out with warning [connectors: tags(Postgres) exclude(CockroachDb) preview_features("views")]
- [ ] `views::postgresql::dupes_are_renamed` — Duplicate view and model names across schemas are renamed [connectors: tags(Postgres) exclude(CockroachDb) preview_features("views") namespaces("public", "private")]
- [ ] `views::postgresql::dupe_views_are_not_considered_without_preview_feature` — Without preview feature, duplicate views are ignored, no rename [connectors: tags(Postgres) exclude(CockroachDb) namespaces("public", "private")]
- [ ] `views::postgresql::ignore_docs_only_added_once` — View missing-unique-identifier doc comment is not duplicated on re-introspection [connectors: tags(Postgres) exclude(CockroachDb) preview_features("views")]
- [ ] `views::postgresql::reserved_name_docs_are_only_added_once` — Reserved-name rename doc comment is not duplicated on re-introspection [connectors: tags(Postgres) exclude(CockroachDb) preview_features("views")]

### schema-engine/sql-introspection-tests/tests/views/sqlite.rs

- [ ] `views::sqlite::basic_view_intro` — View over one table becomes a view block and definition [connectors: tags(Sqlite) preview_features("views")]
- [ ] `views::sqlite::re_intro_keeps_column_arity_and_unique` — Re-introspection preserves existing view column arity and uniqueness [connectors: tags(Sqlite) preview_features("views")]
- [ ] `views::sqlite::defaults_are_introspected` — Table defaults introspected but view columns get none [connectors: tags(Sqlite) preview_features("views")]

### schema-engine/sql-introspection-tests/tests/views/sqlserver.rs

- [ ] `views::sqlserver::simple_view_from_one_table` — View over one table becomes a view block with mapped types [connectors: tags(Mssql) preview_features("views")]
- [ ] `views::sqlserver::simple_view_with_cte` — View defined with a CTE is introspected correctly [connectors: tags(Mssql) preview_features("views")]
- [ ] `views::sqlserver::simple_view_from_two_tables` — View joining two tables introspects computed and joined columns [connectors: tags(Mssql) preview_features("views")]
- [ ] `views::sqlserver::re_intro_keeps_view_to_view_relations` — Re-introspection preserves relations defined between two views [connectors: tags(Mssql) preview_features("views")]
- [ ] `views::sqlserver::views_cannot_have_default_values` — View columns drop database defaults during introspection [connectors: tags(Mssql) preview_features("views")]
- [ ] `views::sqlserver::prisma_defaults_are_kept` — Re-introspection preserves Prisma-authored @default on view fields [connectors: tags(Mssql) preview_features("views")]

**Total: 617 tests**
