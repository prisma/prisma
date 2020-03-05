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
  a  a   @map(["one", "two"])
}
`
