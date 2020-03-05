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

datasource mysql {
  provider = "mysql"
  url = "***"
}

model teams {
  id   Int    @id
  name String @unique
}

model users {
  email String @unique
  id    Int    @default(autoincrement()) @id
}
`
