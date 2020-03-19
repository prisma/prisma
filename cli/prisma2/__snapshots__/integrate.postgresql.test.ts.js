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

exports['users.findMany({ where: { email: \'MAX@PRISMA.IO\' } })'] = `
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

exports['users.findMany({ where: { team_id: null } })'] = `
generator client {
  provider = "prisma-client-js"
  output = "***"
}

datasource pg {
  provider = "postgresql"
  url = "***"
}

model teams {
  id    Int     @default(autoincrement()) @id
  name  String
  token Int     @unique
  users users[]
}

model users {
  email   String @unique
  id      Int    @default(autoincrement()) @id
  team_id teams?
}
`
