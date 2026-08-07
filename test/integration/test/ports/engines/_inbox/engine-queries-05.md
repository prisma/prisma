## data_types/float.rs

PASS `test/integration/test/ports/engines/queries/data_types/float/float.test.ts` › `read_one` — reads one nullable Float scalar back
PASS `test/integration/test/ports/engines/queries/data_types/float/float.test.ts` › `read_many` — reads many Float values including null

## data_types/int.rs

PASS `test/integration/test/ports/engines/queries/data_types/int/int.test.ts` › `read_one` — reads one nullable Int scalar back
PASS `test/integration/test/ports/engines/queries/data_types/int/int.test.ts` › `read_many` — reads many Int values including null

## data_types/json.rs

FAIL `test/integration/test/ports/engines/queries/data_types/json/json.test.ts` › `read_one` — reads one Json scalar back as an empty object — prisma-next throws while decoding the Jsonb result because the codec instance has no descriptor
FAIL `test/integration/test/ports/engines/queries/data_types/json/json.test.ts` › `read_many` — reads varied Json scalar values — prisma-next throws while decoding Jsonb results because the codec instance has no descriptor
FAIL `test/integration/test/ports/engines/queries/data_types/json/json.test.ts` › `read_plain_float` — reads a plain float Json value — prisma-next throws while decoding the Jsonb result because the codec instance has no descriptor
FAIL `test/integration/test/ports/engines/queries/data_types/json/json.test.ts` › `read_plain_int` — reads a plain integer Json value — prisma-next throws while decoding the Jsonb result because the codec instance has no descriptor
FAIL `test/integration/test/ports/engines/queries/data_types/json/json.test.ts` › `read_plain_bool` — reads a plain boolean Json value — prisma-next throws while decoding the Jsonb result because the codec instance has no descriptor
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/data_types/json.rs` › `queries::data_types::json::json_null` — distinguishes database NULL from JSON null — prisma-next has no public DbNull/JsonNull input sentinels for selecting the two storage values explicitly
FAIL `test/integration/test/ports/engines/queries/data_types/json/json.test.ts` › `json_null_must_not_be_confused_with_literal_string` — distinguishes the literal JSON string "null" from JSON null — prisma-next stores the string input `null` as JSON null and returns null
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/data_types/json.rs` › `queries::data_types::json::dollar_type_in_json_protocol` — unwraps a top-level query-engine JSON-protocol `$type: Raw` wrapper while preserving a nested `$type` key — prisma-next exposes no query-engine JSON wire-protocol input surface on which to send the Raw wrapper
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/data_types/json.rs` › `queries::data_types::json::nested_dollar_type_in_json_protocol` — unwraps a nested query-engine JSON-protocol `$type: Raw` wrapper — prisma-next exposes no query-engine JSON wire-protocol input surface on which to send the Raw wrapper
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/data_types/json.rs` › `queries::data_types::json::json_list` — reads only a related child's Json list through a relation — prisma-next's SQL ORM cannot project a relation without also selecting at least one parent scalar, so it cannot express the source selection shape without adding data

## data_types/native/mssql.rs

- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/data_types/native/mssql.rs` › `queries::data_types::native::mssql::native_string` — verifies SQL Server VarChar casting in filters — SQL Server is outside the supported target providers

## data_types/native/mysql.rs

- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/data_types/native/mysql.rs` › `queries::data_types::native::mysql::dt_native` — reads MySQL native date/time/timestamp/year types — MySQL is outside the supported target providers
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/data_types/native/mysql.rs` › `queries::data_types::native::mysql::native_decimal_types` — reads MySQL native Float/Double/Decimal types — MySQL is outside the supported target providers
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/data_types/native/mysql.rs` › `queries::data_types::native::mysql::native_string` — reads MySQL native Char/VarChar/Text types — MySQL is outside the supported target providers
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/data_types/native/mysql.rs` › `queries::data_types::native::mysql::native_bytes` — reads MySQL native Bit/Binary/Blob types — MySQL is outside the supported target providers

## data_types/native/postgres.rs

- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/data_types/native/postgres.rs` › `queries::data_types::native::postgres::dt_native` — coerces full ISO DateTime inputs into Postgres date, time, timetz, timestamp, and timestamptz fields and normalizes offsets — prisma-next's Time and Timetz public inputs are branded time-only strings and cannot accept the source DateTime input form
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/data_types/native/postgres.rs` › `queries::data_types::native::postgres::native_decimal_types` — reads Real, DoublePrecision, Decimal, and Money native fields together — prisma-next has no Money codec/PSL type, so the faithful schema cannot be authored
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/data_types/native/postgres.rs` › `queries::data_types::native::postgres::native_money_type` — reads Postgres Money scalar and Money[] values seeded as currency strings — prisma-next has no Money scalar or array codec/PSL type
PASS `test/integration/test/ports/engines/queries/data_types/native/postgres/postgres.test.ts` › `native_string` — reads Char, VarChar, Text, Bit, VarBit, Uuid, and Inet native fields together
PASS `test/integration/test/ports/engines/queries/data_types/native/postgres/postgres.test.ts` › `native_other_types` — reads Postgres Boolean, ByteA, Json, and JsonB native values through a relation
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/data_types/native/postgres.rs` › `queries::data_types::native::postgres::native_xml` — reads a Postgres Xml native field — prisma-next has no Xml codec/PSL type

## data_types/string.rs

PASS `test/integration/test/ports/engines/queries/data_types/string/string.test.ts` › `read_one` — reads one nullable String scalar back
PASS `test/integration/test/ports/engines/queries/data_types/string/string.test.ts` › `read_many` — reads many String values including null

## data_types/through_relation.rs

PASS `test/integration/test/ports/engines/queries/data_types/through_relation/through_relation.test.ts` › `common_types` — reads common scalar values on children through both many and unique parent relation queries
PASS `test/integration/test/ports/engines/queries/data_types/through_relation/through_relation.test.ts` › `json_type` — reads Json values on children through both many and unique parent relation queries
PASS `test/integration/test/ports/engines/queries/data_types/through_relation/through_relation.test.ts` › `enum_type` — reads enum values on children through both many and unique parent relation queries
FAIL `test/integration/test/ports/engines/queries/data_types/through_relation/through_relation.test.ts` › `decimal_type` — reads Decimal values on children through both many and unique parent relation queries — prisma-next preserves the input scale and returns `123.45678910` instead of Prisma's normalized `123.4567891`
FAIL `test/integration/test/ports/engines/queries/data_types/through_relation/through_relation.test.ts` › `scalar_lists` — reads scalar-list fields on a child through both many and unique parent relation queries — prisma-next requires the omitted `unset` list and writes SQL NULL, violating the non-null constraint instead of defaulting it to []
- `query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/data_types/through_relation.rs` › `queries::data_types::through_relation::oid_type` — reads and orders Postgres Oid-typed Int values through a relation — prisma-next has no Oid codec/PSL type
