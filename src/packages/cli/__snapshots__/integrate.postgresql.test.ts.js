exports['findOne - check typeof array for Json field with array_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model posts {
  id    Int    @default(autoincrement()) @id
  title String
  data  Json
}

`

exports['findOne - check typeof array for Json field with array_warnings'] = []

exports['findOne where PK_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model teams {
  id   Int    @id
  name String @unique
}

`

exports['findOne where PK_warnings'] = []

exports['findOne where PK with select_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model teams {
  id    Int    @id
  name  String @unique
  email String @unique
}

`

exports['findOne where PK with select_warnings'] = []

exports['findOne where PK with include_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model posts {
  id      Int    @default(autoincrement()) @id
  user_id Int
  title   String
  users   users  @relation(fields: [user_id], references: [id])
}

model users {
  id    Int     @default(autoincrement()) @id
  email String  @unique
  posts posts[]
}

`

exports['findOne where PK with include_warnings'] = []

exports['create with data_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model teams {
  id   Int    @default(autoincrement()) @id
  name String @unique
}

`

exports['create with data_warnings'] = []

exports['create with empty data and SQL default_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model teams {
  id   Int    @default(autoincrement()) @id
  name String @default("alice")
}

`

exports['create with empty data and SQL default_warnings'] = []

exports['update where with numeric data_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model teams {
  id   Int    @default(autoincrement()) @id
  name String @unique
}

`

exports['update where with numeric data_warnings'] = []

exports['update where with boolean data_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model teams {
  id     Int     @default(autoincrement()) @id
  name   String  @unique
  active Boolean @default(true)
}

`

exports['update where with boolean data_warnings'] = []

exports['update where with boolean data and select_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model teams {
  id     Int     @default(autoincrement()) @id
  name   String  @unique
  active Boolean @default(true)
}

`

exports['update where with boolean data and select_warnings'] = []

exports['update where with string data_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model teams {
  id   Int    @default(autoincrement()) @id
  name String @unique
}

`

exports['update where with string data_warnings'] = []

exports['updateMany where with string data - check returned count_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model teams {
  id   Int    @default(autoincrement()) @id
  name String
}

`

exports['updateMany where with string data - check returned count_warnings'] = []

exports['updateMany where with string data - check findMany_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model teams {
  id   Int    @default(autoincrement()) @id
  name String
}

`

exports['updateMany where with string data - check findMany_warnings'] = []

exports['findOne where unique_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model users {
  id    Int    @default(autoincrement()) @id
  email String @unique
}

`

exports['findOne where unique_warnings'] = []

exports['findOne where composite unique_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model users {
  id    Int    @default(autoincrement()) @id
  email String
  name  String

  @@unique([email, name], name: "users_email_name_key")
}

`

exports['findOne where composite unique_warnings'] = []

exports['update where composite unique_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model users {
  id    Int    @default(autoincrement()) @id
  email String
  name  String

  @@unique([email, name], name: "users_email_name_key")
}

`

exports['update where composite unique_warnings'] = []

exports['delete where composite unique_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model users {
  id    Int    @default(autoincrement()) @id
  email String
  name  String

  @@unique([email, name], name: "users_email_name_key")
}

`

exports['delete where composite unique_warnings'] = []

exports['findMany - email text_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model users {
  id    Int     @default(autoincrement()) @id
  email String?
}

`

exports['findMany - email text_warnings'] = []

exports['findMany where unique_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model users {
  id    Int    @default(autoincrement()) @id
  email String @unique
}

`

exports['findMany where unique_warnings'] = []

exports['findMany - email varchar(50) not null unique_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model users {
  id    Int    @default(autoincrement()) @id
  email String @unique
}

`

exports['findMany - email varchar(50) not null unique_warnings'] = []

exports['findOne where unique with foreign key and unpack_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model posts {
  id      Int    @default(autoincrement()) @id
  user_id Int
  title   String
  users   users  @relation(fields: [user_id], references: [id])
}

model users {
  id    Int     @default(autoincrement()) @id
  email String  @unique
  posts posts[]
}

`

exports['findOne where unique with foreign key and unpack_warnings'] = []

exports['findMany where contains and boolean_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model posts {
  id        Int     @default(autoincrement()) @id
  title     String
  published Boolean @default(false)
}

`

exports['findMany where contains and boolean_warnings'] = []

exports['findMany where OR[contains, contains] _datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model posts {
  id        Int     @default(autoincrement()) @id
  title     String
  published Boolean @default(false)
}

`

exports['findMany where OR[contains, contains] _warnings'] = []

exports['upsert (update)_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model posts {
  id        Int     @default(autoincrement()) @id
  title     String
  published Boolean @default(false)
}

`

exports['upsert (update)_warnings'] = []

exports['upsert (create)_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model posts {
  id        Int     @default(autoincrement()) @id
  title     String
  published Boolean @default(false)
}

`

exports['upsert (create)_warnings'] = []

exports['findMany orderBy asc_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model posts {
  id        Int     @default(autoincrement()) @id
  title     String
  published Boolean @default(false)
}

`

exports['findMany orderBy asc_warnings'] = []

exports['findMany orderBy desc_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model posts {
  id        Int     @default(autoincrement()) @id
  title     String
  published Boolean @default(false)
}

`

exports['findMany orderBy desc_warnings'] = []

exports['findMany - default enum_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model posts {
  id        Int          @default(autoincrement()) @id
  title     String
  published posts_status @default(DRAFT)
}

enum posts_status {
  DRAFT
  PUBLISHED
}

`

exports['findMany - default enum_warnings'] = []

exports['update with data - not null enum_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model posts {
  id        Int          @default(autoincrement()) @id
  title     String
  published posts_status @default(DRAFT)
}

enum posts_status {
  DRAFT
  PUBLISHED
}

`

exports['update with data - not null enum_warnings'] = []

exports['updateMany with data - not null enum - check count_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model posts {
  id        Int          @default(autoincrement()) @id
  title     String
  published posts_status @default(DRAFT)
}

enum posts_status {
  DRAFT
  PUBLISHED
}

`

exports['updateMany with data - not null enum - check count_warnings'] = []

exports['update with data - not null enum - check findMany_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model posts {
  id        Int          @default(autoincrement()) @id
  title     String
  published posts_status @default(DRAFT)
}

enum posts_status {
  DRAFT
  PUBLISHED
}

`

exports['update with data - not null enum - check findMany_warnings'] = []

exports['deleteMany where enum - check count_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model posts {
  id        Int          @default(autoincrement()) @id
  title     String
  published posts_status @default(DRAFT)
}

enum posts_status {
  DRAFT
  PUBLISHED
}

`

exports['deleteMany where enum - check count_warnings'] = []

exports['deleteMany where enum - check findMany_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model posts {
  id        Int          @default(autoincrement()) @id
  title     String
  published posts_status @default(DRAFT)
}

enum posts_status {
  DRAFT
  PUBLISHED
}

`

exports['deleteMany where enum - check findMany_warnings'] = []

exports['findMany where contains_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model crons {
  id        Int     @default(autoincrement()) @id
  job       String  @unique
  frequency String?
}

`

exports['findMany where contains_warnings'] = []

exports['findMany where startsWith_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model crons {
  id        Int     @default(autoincrement()) @id
  job       String  @unique
  frequency String?
}

`

exports['findMany where startsWith_warnings'] = []

exports['findMany where endsWith_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model crons {
  id        Int     @default(autoincrement()) @id
  job       String  @unique
  frequency String?
}

`

exports['findMany where endsWith_warnings'] = []

exports['findMany where in[string]_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model crons {
  id        Int     @default(autoincrement()) @id
  job       String  @unique
  frequency String?
}

`

exports['findMany where in[string]_warnings'] = []

exports['findMany where datetime lte - check instanceof Date_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model posts {
  id         Int      @default(autoincrement()) @id
  title      String
  created_at DateTime @default(now())
}

`

exports['findMany where datetime lte - check instanceof Date_warnings'] = []

exports['findMany where timestamp gte than now_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model posts {
  id         Int      @default(autoincrement()) @id
  title      String
  created_at DateTime @default(now())
}

`

exports['findMany where timestamp gte than now_warnings'] = []

exports['findMany where timestamp gt than now_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model posts {
  id         Int      @default(autoincrement()) @id
  title      String
  created_at DateTime @default(now())
}

`

exports['findMany where timestamp gt than now_warnings'] = []

exports['findMany where timestamp lt than now_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model posts {
  id         Int      @default(autoincrement()) @id
  title      String
  created_at DateTime @default(now())
}

`

exports['findMany where timestamp lt than now_warnings'] = []

exports['update where integer data_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model teams {
  id    Int @default(autoincrement()) @id
  token Int @unique
}

`

exports['update where integer data_warnings'] = []

exports['findMany where datetime exact_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model events {
  id   Int       @default(autoincrement()) @id
  time DateTime?
}

`

exports['findMany where datetime exact_warnings'] = []

exports['findMany where datetime gt_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model events {
  id   Int       @default(autoincrement()) @id
  time DateTime?
}

`

exports['findMany where datetime gt_warnings'] = []

exports['findMany where datetime gte_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model events {
  id   Int       @default(autoincrement()) @id
  time DateTime?
}

`

exports['findMany where datetime gte_warnings'] = []

exports['findMany where datetime lt_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model events {
  id   Int       @default(autoincrement()) @id
  time DateTime?
}

`

exports['findMany where datetime lt_warnings'] = []

exports['findMany where datetime lte_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model events {
  id   Int       @default(autoincrement()) @id
  time DateTime?
}

`

exports['findMany where datetime lte_warnings'] = []

exports['findMany where datetime not_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model events {
  id   Int       @default(autoincrement()) @id
  time DateTime?
}

`

exports['findMany where datetime not_warnings'] = []

exports['findMany where null_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model events {
  id   Int       @default(autoincrement()) @id
  time DateTime?
}

`

exports['findMany where null_warnings'] = []

exports['findMany where empty in[]_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model teams {
  id    Int    @default(autoincrement()) @id
  token Int    @unique
  name  String
}

`

exports['findMany where empty in[]_warnings'] = []

exports['findMany where id empty in[] and token in[]_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model teams {
  id    Int    @default(autoincrement()) @id
  token Int    @unique
  name  String
}

`

exports['findMany where id empty in[] and token in[]_warnings'] = []

exports['findMany where in[integer]_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model teams {
  id    Int    @default(autoincrement()) @id
  token Int    @unique
  name  String
}

`

exports['findMany where in[integer]_warnings'] = []

exports['findMany where notIn[]_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model teams {
  id    Int    @default(autoincrement()) @id
  token Int    @unique
  name  String
}

`

exports['findMany where notIn[]_warnings'] = []

exports['findMany where empty notIn[]_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model teams {
  id    Int    @default(autoincrement()) @id
  token Int    @unique
  name  String
}

`

exports['findMany where empty notIn[]_warnings'] = []

exports['findMany where - case insensitive field_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model users {
  id    Int    @default(autoincrement()) @id
  email String @unique
}

`

exports['findMany where - case insensitive field_warnings'] = []

exports['findMany where decimal_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model exercises {
  id       Int   @default(autoincrement()) @id
  distance Float
}

`

exports['findMany where decimal_warnings'] = []

exports['findOne where decimal_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model exercises {
  id       Int   @default(autoincrement()) @id
  distance Float @unique
}

`

exports['findOne where decimal_warnings'] = []

exports['findOne where decimal - default value_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model exercises {
  id       Int   @default(autoincrement()) @id
  distance Float @default(12.3) @unique
}

`

exports['findOne where decimal - default value_warnings'] = []

exports['create bigint data_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model migrate {
  version Int @id
}

`

exports['create bigint data_warnings'] = []

exports['findOne where composite PK_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model variables {
  name  String
  key   String
  value String
  email String

  @@id([name, key])
}

`

exports['findOne where composite PK_warnings'] = []

exports['update where composite PK_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model variables {
  name  String
  key   String
  value String
  email String

  @@id([name, key])
}

`

exports['update where composite PK_warnings'] = []

exports['upsert where composite PK - update_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model variables {
  name  String
  key   String
  value String
  email String

  @@id([name, key])
}

`

exports['upsert where composite PK - update_warnings'] = []

exports['upsert where composite PK - create_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model variables {
  name  String
  key   String
  value String
  email String

  @@id([name, key])
}

`

exports['upsert where composite PK - create_warnings'] = []

exports['delete where composite PK_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model variables {
  name  String
  key   String
  value String
  email String

  @@id([name, key])
}

`

exports['delete where composite PK_warnings'] = []

exports['findOne where unique composite_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model variables {
  id    Int    @default(autoincrement()) @id
  name  String
  key   String
  value String
  email String

  @@unique([name, key], name: "variables_name_key_key")
}

`

exports['findOne where unique composite_warnings'] = []

exports['findOne where unique composite (PK is a composite)_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model variables {
  name  String
  key   String
  value String
  email String

  @@id([name, key])
  @@unique([value, email], name: "variables_value_email_key")
}

`

exports['findOne where unique composite (PK is a composite)_warnings'] = []

exports['findOne where composite PK with foreign key_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model a {
  one Int
  two Int
  b   b[]

  @@id([one, two])
}

model b {
  id  Int @default(autoincrement()) @id
  one Int
  two Int
  a   a   @relation(fields: [one, two], references: [one, two])
}

`

exports['findOne where composite PK with foreign key_warnings'] = []

exports['updateMany where null - check findMany_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model teams {
  id   Int     @default(autoincrement()) @id
  name String?
}

`

exports['updateMany where null - check findMany_warnings'] = []

exports['findMany on column_name_that_becomes_empty_string_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model column_name_that_becomes_empty_string {
  field1   Int  @default(autoincrement()) @id
  // This field was commented out because of an invalid name. Please provide a valid one that matches [a-zA-Z][a-zA-Z0-9_]*
  // 12345 Int? @map("12345")
}

model invalid_enum_value_name {
  field1       Int           @default(autoincrement()) @id
  here_be_enum invalid_enum?
}

// The underlying table does not contain a valid unique identifier and can therefore currently not be handled.
// model no_unique_identifier {
  // field1 Int?
  // field2 Int?
// }

model unsupported_type {
  field1         Int        @default(autoincrement()) @id
  // This type is currently not supported.
  // unsupported geometric?
}

enum invalid_enum {
  // $§! @map("$§!")
  // 123 @map("123")
  N
  Y
}

`

exports['findMany on column_name_that_becomes_empty_string_warnings'] = [
  {
    "code": 1,
    "message": "The following models were commented out as they do not have a valid unique identifier or id. This is currently not supported by Prisma.",
    "affected": [
      {
        "model": "no_unique_identifier"
      }
    ]
  },
  {
    "code": 2,
    "message": "These fields were commented out because their names are currently not supported by Prisma. Please provide valid ones that match [a-zA-Z][a-zA-Z0-9_]* using the `@map` directive.",
    "affected": [
      {
        "model": "column_name_that_becomes_empty_string",
        "field": "12345"
      }
    ]
  },
  {
    "code": 3,
    "message": "These fields were commented out because Prisma currently does not support their types.",
    "affected": [
      {
        "model": "unsupported_type",
        "field": "unsupported",
        "tpe": "geometric"
      }
    ]
  },
  {
    "code": 4,
    "message": "These enum values were commented out because their names are currently not supported by Prisma. Please provide valid ones that match [a-zA-Z][a-zA-Z0-9_]* using the `@map` directive.",
    "affected": [
      {
        "enm": "invalid_enum",
        "value": "$§!"
      },
      {
        "enm": "invalid_enum",
        "value": "123"
      }
    ]
  }
]

exports['findOne - check typeof js object is object for Json field_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model posts {
  id    Int    @default(autoincrement()) @id
  title String
  data  Json?
}

`

exports['findOne - check typeof js object is object for Json field_warnings'] = []

exports['findOne - check typeof Date is string for Json field_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model posts {
  id    Int    @default(autoincrement()) @id
  title String
  data  Json?
}

`

exports['findOne - check typeof Date is string for Json field_warnings'] = []
