exports['teams.findOne({ where: { id: 2 } })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  id   Int    @id
  name String @unique
}
`

exports['teams.findOne({ where: { id: 2 } })_warnings'] = []

exports['teams.findOne({ where: { id: 2 }, select: { name: true } })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}
`

exports['teams.findOne({ where: { id: 2 }, select: { name: true } })_warnings'] = []

exports['users.findOne({ where: { id: 1 }, include: { posts: true } })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model users {
  email String  @unique
  id    Int     @default(autoincrement()) @id
  posts posts[]
}

model posts {
  id      Int    @default(autoincrement()) @id
  title   String
  user_id Int
  users   users  @relation(fields: [user_id], references: [id])
}
`

exports['users.findOne({ where: { id: 1 }, include: { posts: true } })_warnings'] = []

exports['teams.create({ data: { name: \'c\' } })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  id   Int    @default(autoincrement()) @id
  name String @unique
}
`

exports['teams.create({ data: { name: \'c\' } })_warnings'] = []

exports['teams.create({ data: {} })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  id   Int    @default(autoincrement()) @id
  name String @default("alice")
}
`

exports['teams.create({ data: {} })_warnings'] = []

exports['teams.update({ where: { id: 1 }, data: { name: \'d\' }, })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  id   Int    @default(autoincrement()) @id
  name String @unique
}
`

exports['teams.update({ where: { id: 1 }, data: { name: \'d\' }, })_warnings'] = []

exports['teams.update({ where: { id: 1 }, data: { active: false }, })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  active Boolean @default(true)
  id     Int     @default(autoincrement()) @id
  name   String  @unique
}
`

exports['teams.update({ where: { id: 1 }, data: { active: false }, })_warnings'] = []

exports['teams.update({ where: { id: 1 }, data: { active: false }, select: { active: true }, })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  active Boolean @default(true)
  id     Int     @default(autoincrement()) @id
  name   String  @unique
}
`

exports['teams.update({ where: { id: 1 }, data: { active: false }, select: { active: true }, })_warnings'] = []

exports['teams.update({ where: { name: \'c\' }, data: { name: \'d\' }, })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  id   Int    @default(autoincrement()) @id
  name String @unique
}
`

exports['teams.update({ where: { name: \'c\' }, data: { name: \'d\' }, })_warnings'] = []

exports['teams.updateMany({ where: { name: \'c\' }, data: { name: \'d\' }, })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  id   Int    @default(autoincrement()) @id
  name String
}
`

exports['teams.updateMany({ where: { name: \'c\' }, data: { name: \'d\' }, })_warnings'] = []

exports['await teams.updateMany({ where: { name: \'c\' }, data: { name: \'d\' }, })  client.teams.findMany();_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  id   Int    @default(autoincrement()) @id
  name String
}
`

exports['await teams.updateMany({ where: { name: \'c\' }, data: { name: \'d\' }, })  client.teams.findMany();_warnings'] = []

exports['users.findOne({ where: { email: \'ada@prisma.io\' } })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model users {
  email String @unique
  id    Int    @default(autoincrement()) @id
}
`

exports['users.findOne({ where: { email: \'ada@prisma.io\' } })_warnings'] = []

exports['users.findMany()_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model users {
  email String?
  id    Int     @default(autoincrement()) @id
}
`

exports['users.findMany()_warnings'] = []

exports['users.findMany({ where: { email: \'ada@prisma.io\' } })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model users {
  email String @unique
  id    Int    @default(autoincrement()) @id
}
`

exports['users.findMany({ where: { email: \'ada@prisma.io\' } })_warnings'] = []

exports['users.findMany()2_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model users {
  email String @unique
  id    Int    @default(autoincrement()) @id
}
`

exports['users.findMany()2_warnings'] = []

exports['users.findOne({ where: { email: \'ada@prisma.io\' } }).posts()_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model users {
  email String  @unique
  id    Int     @default(autoincrement()) @id
  posts posts[]
}

model posts {
  id      Int    @default(autoincrement()) @id
  title   String
  user_id Int
  users   users  @relation(fields: [user_id], references: [id])
}
`

exports['users.findOne({ where: { email: \'ada@prisma.io\' } }).posts()_warnings'] = []

exports['posts.findMany({ where: { title: { contains: \'A\' }, published: true, }, })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model posts {
  id        Int     @default(autoincrement()) @id
  published Boolean @default(false)
  title     String
}
`

exports['posts.findMany({ where: { title: { contains: \'A\' }, published: true, }, })_warnings'] = []

exports['posts.findMany({ where: { OR: [{ title: { contains: \'A\' } }, { title: { contains: \'C\' } }], published: true, }, })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model posts {
  id        Int     @default(autoincrement()) @id
  published Boolean @default(false)
  title     String
}
`

exports['posts.findMany({ where: { OR: [{ title: { contains: \'A\' } }, { title: { contains: \'C\' } }], published: true, }, })_warnings'] = []

exports['posts.upsert({ where: { id: 1 }, create: { title: \'D\', published: true }, update: { title: \'D\', published: true }, })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model posts {
  id        Int     @default(autoincrement()) @id
  published Boolean @default(false)
  title     String
}
`

exports['posts.upsert({ where: { id: 1 }, create: { title: \'D\', published: true }, update: { title: \'D\', published: true }, })_warnings'] = []

exports['posts.upsert({ where: { id: 4 }, create: { title: \'D\', published: false }, update: { title: \'D\', published: true }, })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model posts {
  id        Int     @default(autoincrement()) @id
  published Boolean @default(false)
  title     String
}
`

exports['posts.upsert({ where: { id: 4 }, create: { title: \'D\', published: false }, update: { title: \'D\', published: true }, })_warnings'] = []

exports['posts.findMany({ orderBy: { title: \'asc\', }, })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model posts {
  id        Int     @default(autoincrement()) @id
  published Boolean @default(false)
  title     String
}
`

exports['posts.findMany({ orderBy: { title: \'asc\', }, })_warnings'] = []

exports['posts.findMany({ orderBy: { title: \'desc\', }, })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model posts {
  id        Int     @default(autoincrement()) @id
  published Boolean @default(false)
  title     String
}
`

exports['posts.findMany({ orderBy: { title: \'desc\', }, })_warnings'] = []

exports['crons.findMany({ where: { job: { contains: \'j2\' } } })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model crons {
  frequency String?
  id        Int     @default(autoincrement()) @id
  job       String  @unique
}
`

exports['crons.findMany({ where: { job: { contains: \'j2\' } } })_warnings'] = []

exports['crons.findMany({ where: { job: { startsWith: \'j2\' } } })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model crons {
  frequency String?
  id        Int     @default(autoincrement()) @id
  job       String  @unique
}
`

exports['crons.findMany({ where: { job: { startsWith: \'j2\' } } })_warnings'] = []

exports['crons.findMany({ where: { job: { endsWith: \'1\' } } })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model crons {
  frequency String?
  id        Int     @default(autoincrement()) @id
  job       String  @unique
}
`

exports['crons.findMany({ where: { job: { endsWith: \'1\' } } })_warnings'] = []

exports['crons.findMany({ where: { job: { in: [\'j20\', \'j1\'] } } })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model crons {
  frequency String?
  id        Int     @default(autoincrement()) @id
  job       String  @unique
}
`

exports['crons.findMany({ where: { job: { in: [\'j20\', \'j1\'] } } })_warnings'] = []

exports['const posts = await posts.findMany({ where: { created_at: { lte: new Date() } } }) posts.forEach((post) => { assert_1.default.ok(post.created_at instanceof Date); delete post.created_at; });  posts;_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model posts {
  created_at DateTime @default(now())
  id         Int      @default(autoincrement()) @id
  title      String
}
`

exports['const posts = await posts.findMany({ where: { created_at: { lte: new Date() } } }) posts.forEach((post) => { assert_1.default.ok(post.created_at instanceof Date); delete post.created_at; });  posts;_warnings'] = []

exports['posts.findMany({ where: { created_at: { gte: new Date() } } })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model posts {
  created_at DateTime @default(now())
  id         Int      @default(autoincrement()) @id
  title      String
}
`

exports['posts.findMany({ where: { created_at: { gte: new Date() } } })_warnings'] = []

exports['posts.findMany({ where: { created_at: { gt: new Date() } } })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model posts {
  created_at DateTime @default(now())
  id         Int      @default(autoincrement()) @id
  title      String
}
`

exports['posts.findMany({ where: { created_at: { gt: new Date() } } })_warnings'] = []

exports['const posts = await posts.findMany({ where: { created_at: { lt: new Date() } } }) posts.forEach((post) => { assert_1.default.ok(post.created_at instanceof Date); delete post.created_at; });  posts;_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model posts {
  created_at DateTime @default(now())
  id         Int      @default(autoincrement()) @id
  title      String
}
`

exports['const posts = await posts.findMany({ where: { created_at: { lt: new Date() } } }) posts.forEach((post) => { assert_1.default.ok(post.created_at instanceof Date); delete post.created_at; });  posts;_warnings'] = []

exports['teams.update({ where: { token: 11 }, data: { token: 10 } })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  id    Int @default(autoincrement()) @id
  token Int @unique
}
`

exports['teams.update({ where: { token: 11 }, data: { token: 10 } })_warnings'] = []

exports['await events.findMany({ where: { time: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model events {
  id   Int       @default(autoincrement()) @id
  time DateTime?
}
`

exports['await events.findMany({ where: { time: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } })_warnings'] = []

exports['events.findMany({ where: { time: { gt: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } } })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model events {
  id   Int       @default(autoincrement()) @id
  time DateTime?
}
`

exports['events.findMany({ where: { time: { gt: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } } })_warnings'] = []

exports['events.findMany({ where: { time: { gte: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } } })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model events {
  id   Int       @default(autoincrement()) @id
  time DateTime?
}
`

exports['events.findMany({ where: { time: { gte: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } } })_warnings'] = []

exports['events.findMany({ where: { time: { lt: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } } })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model events {
  id   Int       @default(autoincrement()) @id
  time DateTime?
}
`

exports['events.findMany({ where: { time: { lt: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } } })_warnings'] = []

exports['events.findMany({ where: { time: { lte: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } } })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model events {
  id   Int       @default(autoincrement()) @id
  time DateTime?
}
`

exports['events.findMany({ where: { time: { lte: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } } })_warnings'] = []

exports['events.findMany({ where: { time: { not: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } } })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model events {
  id   Int       @default(autoincrement()) @id
  time DateTime?
}
`

exports['events.findMany({ where: { time: { not: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } } })_warnings'] = []

exports['teams.findMany({ where: { id: { in: [] } } })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  id    Int    @default(autoincrement()) @id
  name  String
  token Int    @unique
}
`

exports['teams.findMany({ where: { id: { in: [] } } })_warnings'] = []

exports['teams.findMany({ where: { id: { in: [] }, token: { in: [11, 22] } } })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  id    Int    @default(autoincrement()) @id
  name  String
  token Int    @unique
}
`

exports['teams.findMany({ where: { id: { in: [] }, token: { in: [11, 22] } } })_warnings'] = []

exports['teams.findMany({ where: { token: { in: [11, 22] } } })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  id    Int    @default(autoincrement()) @id
  name  String
  token Int    @unique
}
`

exports['teams.findMany({ where: { token: { in: [11, 22] } } })_warnings'] = []

exports['teams.findMany({ where: { token: { notIn: [11, 22] } } })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  id    Int    @default(autoincrement()) @id
  name  String
  token Int    @unique
}
`

exports['teams.findMany({ where: { token: { notIn: [11, 22] } } })_warnings'] = []

exports['teams.findMany({ where: { token: { notIn: [] } } })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  id    Int    @default(autoincrement()) @id
  name  String
  token Int    @unique
}
`

exports['teams.findMany({ where: { token: { notIn: [] } } })_warnings'] = []

exports['users.findMany({ where: { email: \'MAX@PRISMA.IO\' } })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model users {
  email String @unique
  id    Int    @default(autoincrement()) @id
}
`

exports['users.findMany({ where: { email: \'MAX@PRISMA.IO\' } })_warnings'] = []

exports['exercises.findMany({ where: { distance: 12.213 } })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model exercises {
  distance Float
  id       Int   @default(autoincrement()) @id
}
`

exports['exercises.findMany({ where: { distance: 12.213 } })_warnings'] = []

exports['exercises.findOne({ where: { distance: 12.213 } })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model exercises {
  distance Float @unique
  id       Int   @default(autoincrement()) @id
}
`

exports['exercises.findOne({ where: { distance: 12.213 } })_warnings'] = []

exports['exercises.findOne({ where: { distance: 12.3 } })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model exercises {
  distance Float @default(12.3) @unique
  id       Int   @default(autoincrement()) @id
}
`

exports['exercises.findOne({ where: { distance: 12.3 } })_warnings'] = []

exports['migrate.create({ data: { version: 1 } })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model migrate {
  version Int @id
}
`

exports['migrate.create({ data: { version: 1 } })_warnings'] = []

exports['variables.findOne({ where: { name_key: { key: \'b\', name: \'a\' } } })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model variables {
  email String
  key   String
  name  String
  value String

  @@id([name, key])
}
`

exports['variables.findOne({ where: { name_key: { key: \'b\', name: \'a\' } } })_warnings'] = []

exports['variables.update({ where: { name_key: { key: \'b\', name: \'a\' } }, data: { email: \'e\' }, })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model variables {
  email String
  key   String
  name  String
  value String

  @@id([name, key])
}
`

exports['variables.update({ where: { name_key: { key: \'b\', name: \'a\' } }, data: { email: \'e\' }, })_warnings'] = []

exports['variables.upsert({ where: { name_key: { key: \'b\', name: \'a\' } }, create: { name: \'1\', key: \'2\', value: \'3\', email: \'4\' }, update: { email: \'e\' }, })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model variables {
  email String
  key   String
  name  String
  value String

  @@id([name, key])
}
`

exports['variables.upsert({ where: { name_key: { key: \'b\', name: \'a\' } }, create: { name: \'1\', key: \'2\', value: \'3\', email: \'4\' }, update: { email: \'e\' }, })_warnings'] = []

exports['variables.upsert({ where: { name_key: { key: \'d\', name: \'a\' } }, create: { name: \'1\', key: \'2\', value: \'3\', email: \'4\' }, update: { email: \'e\' }, })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model variables {
  email String
  key   String
  name  String
  value String

  @@id([name, key])
}
`

exports['variables.upsert({ where: { name_key: { key: \'d\', name: \'a\' } }, create: { name: \'1\', key: \'2\', value: \'3\', email: \'4\' }, update: { email: \'e\' }, })_warnings'] = []

exports['variables.delete({ where: { name_key: { key: \'b\', name: \'a\' } }, })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model variables {
  email String
  key   String
  name  String
  value String

  @@id([name, key])
}
`

exports['variables.delete({ where: { name_key: { key: \'b\', name: \'a\' } }, })_warnings'] = []

exports['variables.findOne({ where: { sqlite_autoindex_variables_1: { key: \'b\', name: \'a\' } } })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model variables {
  email String
  id    Int    @default(autoincrement()) @id
  key   String
  name  String
  value String

  @@unique([name, key], name: "sqlite_autoindex_variables_1")
}
`

exports['variables.findOne({ where: { sqlite_autoindex_variables_1: { key: \'b\', name: \'a\' } } })_warnings'] = []

exports['variables.findOne({ where: { sqlite_autoindex_variables_2: { value: \'c\', email: \'d\' } } })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model variables {
  email String
  key   String
  name  String
  value String

  @@id([name, key])
  @@unique([value, email], name: "sqlite_autoindex_variables_2")
}
`

exports['variables.findOne({ where: { sqlite_autoindex_variables_2: { value: \'c\', email: \'d\' } } })_warnings'] = []

exports['a.findOne({ where: { one_two: { one: 1, two: 2 } } })_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
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

exports['a.findOne({ where: { one_two: { one: 1, two: 2 } } })_warnings'] = []

exports['await teams.updateMany({ data: { name: \'b\' }, where: { name: null }, })  client.teams.findMany();_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  id   Int     @default(autoincrement()) @id
  name String?
}
`

exports['await teams.updateMany({ data: { name: \'b\' }, where: { name: null }, })  client.teams.findMany();_warnings'] = []

exports['await column_name_that_becomes_empty_string.findMany({})_datamodel'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource sqlite {
  provider = "sqlite"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}

model column_name_that_becomes_empty_string {
  // This field was commented out because of an invalid name. Please provide a valid one that matches [a-zA-Z][a-zA-Z0-9_]*
  // 12345 Int? @map("12345")
  field1   Int  @default(autoincrement()) @id
}

// The underlying table does not contain a unique identifier and can therefore currently not be handled.
// model no_unique_identifier {
  // This type is currently not supported.
  // field1 integer key
  // field2 Int?
// }

model unsupported_type {
  field1         Int         @default(autoincrement()) @id
  // This type is currently not supported.
  // unsupported binary(50)?
}
`

exports['await column_name_that_becomes_empty_string.findMany({})_warnings'] = [
  {
    "code": 1,
    "message": "These models do not have a unique identifier or id and are therefore commented out.",
    "affected": [
      {
        "model": "no_unique_identifier"
      }
    ]
  },
  {
    "code": 2,
    "message": "These fields were commented out because of invalid names. Please provide valid ones that match [a-zA-Z][a-zA-Z0-9_]*.",
    "affected": [
      {
        "model": "column_name_that_becomes_empty_string",
        "field": "12345"
      }
    ]
  },
  {
    "code": 3,
    "message": "These fields were commented out because we currently do not support their types.",
    "affected": [
      {
        "model": "no_unique_identifier",
        "field": "field1",
        "tpe": "integer key"
      },
      {
        "model": "unsupported_type",
        "field": "unsupported",
        "tpe": "binary(50)"
      }
    ]
  }
]
