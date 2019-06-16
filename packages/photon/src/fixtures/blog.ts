export const blog = `
datasource db {
  provider = "sqlite"
  url      = "file:db/migration_engine.db"
  default  = true
}

generator photon {
  provider = "javascript"
  output   = "node_modules/@generated/photon"
}

model Blog {
  id        Int      @id
  name      String
  viewCount Int
  posts     Post[]
  authors   Author[]
}

model Author {
  id    Int     @id
  name  String?
  posts Post[]
  blog  Blog?
}         

model Post {
  id    Int      @id
  title String
  tags  String[]
  blog  Blog?
}

model PostNews {
  new Int @id
  otherField String?
}
`
