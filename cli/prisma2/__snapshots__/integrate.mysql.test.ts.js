exports['await teams.updateMany({ data: { name: \'b\' }, where: { name: null }, })  client.teams.findMany();'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource mysql {
  provider = "mysql"
  url = "***"
}

model teams {
  id   Int     @default(autoincrement()) @id
  name String?
}
`

exports['teams.findOne({ where: { id: 2 } })'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource mysql {
  provider = "mysql"
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

datasource mysql {
  provider = "mysql"
  url = "***"
}

model teams {
  email String @unique
  id    Int    @id
  name  String @unique
}
`

exports['teams.create({ data: { name: \'c\' } })'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource mysql {
  provider = "mysql"
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

datasource mysql {
  provider = "mysql"
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

datasource mysql {
  provider = "mysql"
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

datasource mysql {
  provider = "mysql"
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

datasource mysql {
  provider = "mysql"
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

datasource mysql {
  provider = "mysql"
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

datasource mysql {
  provider = "mysql"
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

datasource mysql {
  provider = "mysql"
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

datasource mysql {
  provider = "mysql"
  url = "***"
}

model users {
  email String @unique
  id    Int    @default(autoincrement()) @id
}
`

exports['users.findMany()'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource mysql {
  provider = "mysql"
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

datasource mysql {
  provider = "mysql"
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

datasource mysql {
  provider = "mysql"
  url = "***"
}

model users {
  email String @unique
  id    Int    @default(autoincrement()) @id
}
`

exports['posts.findMany({ where: { title: { contains: \'A\' }, published: true, }, })'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource mysql {
  provider = "mysql"
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

datasource mysql {
  provider = "mysql"
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

datasource mysql {
  provider = "mysql"
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

datasource mysql {
  provider = "mysql"
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

datasource mysql {
  provider = "mysql"
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

datasource mysql {
  provider = "mysql"
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

datasource mysql {
  provider = "mysql"
  url = "***"
}

model posts {
  id        Int             @default(autoincrement()) @id
  published posts_published @default(DRAFT)
  title     String
}

enum posts_published {
  DRAFT
  PUBLISHED
}
`

exports['posts.update({ where: { id: 1 }, data: { published: \'PUBLISHED\' }, })'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource mysql {
  provider = "mysql"
  url = "***"
}

model posts {
  id        Int             @default(autoincrement()) @id
  published posts_published @default(DRAFT)
  title     String
}

enum posts_published {
  DRAFT
  PUBLISHED
}
`

exports['posts.updateMany({ data: { published: \'PUBLISHED\' }, })'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource mysql {
  provider = "mysql"
  url = "***"
}

model posts {
  id        Int             @default(autoincrement()) @id
  published posts_published @default(DRAFT)
  title     String
}

enum posts_published {
  DRAFT
  PUBLISHED
}
`

exports['await posts.updateMany({ data: { published: \'PUBLISHED\' }, })  client.posts.findMany();'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource mysql {
  provider = "mysql"
  url = "***"
}

model posts {
  id        Int             @default(autoincrement()) @id
  published posts_published @default(DRAFT)
  title     String
}

enum posts_published {
  DRAFT
  PUBLISHED
}
`

exports['await posts.deleteMany({ where: { published: \'DRAFT\' }, })'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource mysql {
  provider = "mysql"
  url = "***"
}

model posts {
  id        Int             @default(autoincrement()) @id
  published posts_published @default(DRAFT)
  title     String
}

enum posts_published {
  DRAFT
  PUBLISHED
}
`

exports['await posts.deleteMany({ where: { published: \'DRAFT\' }, })  client.posts.findMany();'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource mysql {
  provider = "mysql"
  url = "***"
}

model posts {
  id        Int             @default(autoincrement()) @id
  published posts_published @default(DRAFT)
  title     String
}

enum posts_published {
  DRAFT
  PUBLISHED
}
`

exports['crons.findMany({ where: { job: { contains: \'j2\' } } })'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource mysql {
  provider = "mysql"
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

datasource mysql {
  provider = "mysql"
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

datasource mysql {
  provider = "mysql"
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

datasource mysql {
  provider = "mysql"
  url = "***"
}

model crons {
  frequency String?
  id        Int     @default(autoincrement()) @id
  job       String  @unique
}
`

exports['teams.update({ where: { token: 11 }, data: { token: 10 } })'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource mysql {
  provider = "mysql"
  url = "***"
}

model teams {
  id    Int @default(autoincrement()) @id
  token Int @unique
}
`

exports['teams.findMany({ where: { id: { in: [] } } })'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource mysql {
  provider = "mysql"
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

datasource mysql {
  provider = "mysql"
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

datasource mysql {
  provider = "mysql"
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

datasource mysql {
  provider = "mysql"
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

datasource mysql {
  provider = "mysql"
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

datasource mysql {
  provider = "mysql"
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

datasource mysql {
  provider = "mysql"
  url = "***"
}

model exercises {
  distance Float @unique
  id       Int   @default(autoincrement()) @id
}
`

exports['migrate.create({ data: { version: 1 } })'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource mysql {
  provider = "mysql"
  url = "***"
}

model migrate {
  version Int @id
}
`
