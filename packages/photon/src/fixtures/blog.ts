export const blog = `
datasource my_db {
  provider = "sqlite"
  url  = "file:db/migration_engine.db"
  default = true
}

model Blog {
  id Int @id
  name String
  viewCount Int
  posts Post[]
  authors Author[]
}

model Author {
  id Int @id
  name String?
  posts Post[]
  blog Blog
}         

model Post {
  id Int @id
  title String
  tags String[]
  blog Blog
}
`
