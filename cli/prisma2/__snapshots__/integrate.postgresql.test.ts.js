exports['users.findMany()'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model users {
  email String?
  id    Int     @default(autoincrement()) @id
}
`

exports['users.findMany({ where: { email: \'ada@prisma.io\' } })'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model users {
  email String @unique
  id    Int    @default(autoincrement()) @id
}
`

exports['users.findMany()2'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model users {
  email String @unique
  id    Int    @default(autoincrement()) @id
}
`

exports['teams.findOne({ where: { id: 2 } })'] = `
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

exports['teams.findOne({ where: { id: 2 }, select: { name: true } })'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}
`

exports['users.findOne({ where: { id: 1 }, include: { posts: true } })'] = `
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
  title   String
  user_id users  @relation(references: [id])
}

model users {
  email String  @unique
  id    Int     @default(autoincrement()) @id
  posts posts[]
}
`

exports['teams.create({ data: { name: \'c\' } })'] = `
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

exports['teams.create({ data: {} })'] = `
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

exports['teams.update({ where: { id: 1 }, data: { name: \'d\' }, })'] = `
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

exports['teams.update({ where: { id: 1 }, data: { active: false }, })'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model teams {
  active Boolean @default(true)
  id     Int     @default(autoincrement()) @id
  name   String  @unique
}
`

exports['teams.update({ where: { id: 1 }, data: { active: false }, select: { active: true }, })'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model teams {
  active Boolean @default(true)
  id     Int     @default(autoincrement()) @id
  name   String  @unique
}
`

exports['teams.update({ where: { name: \'c\' }, data: { name: \'d\' }, })'] = `
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

exports['teams.updateMany({ where: { name: \'c\' }, data: { name: \'d\' }, })'] = `
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

exports['await teams.updateMany({ where: { name: \'c\' }, data: { name: \'d\' }, })  client.teams.findMany();'] = `
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

exports['users.findOne({ where: { email: \'ada@prisma.io\' } })'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model users {
  email String @unique
  id    Int    @default(autoincrement()) @id
}
`

exports['users.findOne({ where: { users_email_name_key: { email: \'ada@prisma.io\', name: \'Ada\' } } })'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model users {
  email String
  id    Int    @default(autoincrement()) @id
  name  String

  @@unique([email, name], name: "users_email_name_key")
}
`

exports['users.update({ where: { users_email_name_key: { email: \'ada@prisma.io\', name: \'Ada\' } }, data: { name: \'Marco\' }, })'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model users {
  email String
  id    Int    @default(autoincrement()) @id
  name  String

  @@unique([email, name], name: "users_email_name_key")
}
`

exports['users.delete({ where: { users_email_name_key: { email: \'ada@prisma.io\', name: \'Ada\' } }, })'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model users {
  email String
  id    Int    @default(autoincrement()) @id
  name  String

  @@unique([email, name], name: "users_email_name_key")
}
`

exports['users.findOne({ where: { email: \'ada@prisma.io\' } }).posts()'] = `
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
  title   String
  user_id users  @relation(references: [id])
}

model users {
  email String  @unique
  id    Int     @default(autoincrement()) @id
  posts posts[]
}
`

exports['posts.findMany({ where: { title: { contains: \'A\' }, published: true, }, })'] = `
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
  published Boolean @default(false)
  title     String
}
`

exports['posts.findMany({ where: { OR: [{ title: { contains: \'A\' } }, { title: { contains: \'C\' } }], published: true, }, })'] = `
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
  published Boolean @default(false)
  title     String
}
`

exports['posts.upsert({ where: { id: 1 }, create: { title: \'D\', published: true }, update: { title: \'D\', published: true }, })'] = `
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
  published Boolean @default(false)
  title     String
}
`

exports['posts.upsert({ where: { id: 4 }, create: { title: \'D\', published: false }, update: { title: \'D\', published: true }, })'] = `
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
  published Boolean @default(false)
  title     String
}
`

exports['posts.findMany({ orderBy: { title: \'asc\', }, })'] = `
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
  published Boolean @default(false)
  title     String
}
`

exports['posts.findMany({ orderBy: { title: \'desc\', }, })'] = `
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
  published Boolean @default(false)
  title     String
}
`

exports['posts.findMany()'] = `
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
  published posts_status @default(DRAFT)
  title     String
}

enum posts_status {
  DRAFT
  PUBLISHED
}
`

exports['posts.update({ where: { id: 1 }, data: { published: \'PUBLISHED\' }, })'] = `
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
  published posts_status @default(DRAFT)
  title     String
}

enum posts_status {
  DRAFT
  PUBLISHED
}
`

exports['posts.updateMany({ data: { published: \'PUBLISHED\' }, })'] = `
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
  published posts_status @default(DRAFT)
  title     String
}

enum posts_status {
  DRAFT
  PUBLISHED
}
`

exports['await posts.updateMany({ data: { published: \'PUBLISHED\' }, })  client.posts.findMany();'] = `
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
  published posts_status @default(DRAFT)
  title     String
}

enum posts_status {
  DRAFT
  PUBLISHED
}
`

exports['await posts.deleteMany({ where: { published: \'DRAFT\' }, })'] = `
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
  published posts_status @default(DRAFT)
  title     String
}

enum posts_status {
  DRAFT
  PUBLISHED
}
`

exports['await posts.deleteMany({ where: { published: \'DRAFT\' }, })  client.posts.findMany();'] = `
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
  published posts_status @default(DRAFT)
  title     String
}

enum posts_status {
  DRAFT
  PUBLISHED
}
`

exports['crons.findMany({ where: { job: { contains: \'j2\' } } })'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model crons {
  frequency String?
  id        Int     @default(autoincrement()) @id
  job       String  @unique
}
`

exports['crons.findMany({ where: { job: { startsWith: \'j2\' } } })'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model crons {
  frequency String?
  id        Int     @default(autoincrement()) @id
  job       String  @unique
}
`

exports['crons.findMany({ where: { job: { endsWith: \'1\' } } })'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model crons {
  frequency String?
  id        Int     @default(autoincrement()) @id
  job       String  @unique
}
`

exports['crons.findMany({ where: { job: { in: [\'j20\', \'j1\'] } } })'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model crons {
  frequency String?
  id        Int     @default(autoincrement()) @id
  job       String  @unique
}
`

exports['const posts = await posts.findMany({ where: { created_at: { lte: new Date() } } }) posts.forEach(post => { assert_1.default.ok(post.created_at instanceof Date); delete post.created_at; });  posts;'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model posts {
  created_at DateTime @default(now())
  id         Int      @default(autoincrement()) @id
  title      String
}
`

exports['posts.findMany({ where: { created_at: { gte: new Date() } } })'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model posts {
  created_at DateTime @default(now())
  id         Int      @default(autoincrement()) @id
  title      String
}
`

exports['posts.findMany({ where: { created_at: { gt: new Date() } } })'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model posts {
  created_at DateTime @default(now())
  id         Int      @default(autoincrement()) @id
  title      String
}
`

exports['const posts = await posts.findMany({ where: { created_at: { lt: new Date() } } }) posts.forEach(post => { assert_1.default.ok(post.created_at instanceof Date); delete post.created_at; });  posts;'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model posts {
  created_at DateTime @default(now())
  id         Int      @default(autoincrement()) @id
  title      String
}
`

exports['events.findMany({ where: { time: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } })'] = `
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

exports['events.findMany({ where: { time: { gt: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } } })'] = `
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

exports['events.findMany({ where: { time: { gte: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } } })'] = `
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

exports['events.findMany({ where: { time: { lt: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } } })'] = `
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

exports['events.findMany({ where: { time: { lte: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } } })'] = `
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

exports['events.findMany({ where: { time: { not: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } } })'] = `
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

exports['events.findMany({ where: { time: null } })'] = `
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

exports['teams.findMany({ where: { id: { in: [] } } })'] = `
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
  name  String
  token Int    @unique
}
`

exports['teams.findMany({ where: { id: { in: [] }, token: { in: [11, 22] } } })'] = `
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
  name  String
  token Int    @unique
}
`

exports['teams.findMany({ where: { token: { in: [11, 22] } } })'] = `
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
  name  String
  token Int    @unique
}
`

exports['teams.findMany({ where: { token: { notIn: [11, 22] } } })'] = `
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
  name  String
  token Int    @unique
}
`

exports['teams.findMany({ where: { token: { notIn: [] } } })'] = `
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
  name  String
  token Int    @unique
}
`

exports['exercises.findMany({ where: { distance: 12.213 } })'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model exercises {
  distance Float
  id       Int   @default(autoincrement()) @id
}
`

exports['exercises.findOne({ where: { distance: 12.213 } })'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model exercises {
  distance Float @unique
  id       Int   @default(autoincrement()) @id
}
`

exports['exercises.findOne({ where: { distance: 12.3 } })'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model exercises {
  distance Float @default(12.3) @unique
  id       Int   @default(autoincrement()) @id
}
`

exports['migrate.create({ data: { version: 1 } })'] = `
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

exports['variables.findOne({ where: { name_key: { key: \'b\', name: \'a\' } } })'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model variables {
  email String
  key   String
  name  String
  value String

  @@id([name, key])
}
`

exports['variables.update({ where: { name_key: { key: \'b\', name: \'a\' } }, data: { email: \'e\' }, })'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model variables {
  email String
  key   String
  name  String
  value String

  @@id([name, key])
}
`

exports['variables.upsert({ where: { name_key: { key: \'b\', name: \'a\' } }, create: { name: \'1\', key: \'2\', value: \'3\', email: \'4\' }, update: { email: \'e\' }, })'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model variables {
  email String
  key   String
  name  String
  value String

  @@id([name, key])
}
`

exports['variables.upsert({ where: { name_key: { key: \'d\', name: \'a\' } }, create: { name: \'1\', key: \'2\', value: \'3\', email: \'4\' }, update: { email: \'e\' }, })'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model variables {
  email String
  key   String
  name  String
  value String

  @@id([name, key])
}
`

exports['variables.delete({ where: { name_key: { key: \'b\', name: \'a\' } }, })'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model variables {
  email String
  key   String
  name  String
  value String

  @@id([name, key])
}
`

exports['variables.findOne({ where: { variables_name_key_key: { key: \'b\', name: \'a\' } } })'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model variables {
  email String
  id    Int    @default(autoincrement()) @id
  key   String
  name  String
  value String

  @@unique([name, key], name: "variables_name_key_key")
}
`

exports['variables.findOne({ where: { variables_value_email_key: { value: \'c\', email: \'d\' } } })'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model variables {
  email String
  key   String
  name  String
  value String

  @@id([name, key])
  @@unique([value, email], name: "variables_value_email_key")
}
`

exports['a.findOne({ where: { one_two: { one: 1, two: 2 } } })'] = `
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
  id Int @default(autoincrement()) @id
  a  a   @map(["one", "two"]) @relation(references: [one, two])
}
`

exports['await teams.updateMany({ data: { name: \'b\' }, where: { name: null }, })  client.teams.findMany();'] = `
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

exports['teams.update({ where: { token: 11 }, data: { token: 10 } })'] = `
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
