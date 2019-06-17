export const blog = `
datasource db {
  provider = "sqlite"
  url      = "file:db/migration_engine.db"
  default  = true
}

generator photon {
  provider  = "javascript"
  output    = "@generated/photon"
  transpile = false
}

model User {
  id Int @id
  name String?
  posts Post[]
}         

model Post {
  id Int @id
  title String
  tags String[]
  author User
}
`
