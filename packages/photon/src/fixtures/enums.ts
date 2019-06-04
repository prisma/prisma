export const enums = /* GraphQL */ `
  model User {
    id: ID @id
    name: String
    email: String @unique
    status: String
    nicknames: String[]
    permissions: Permission[]
    favoriteTree: Tree
    location: Location
    posts: Post[]
  }

  model Post {
    id: ID @id
    name: String
    email: String @unique
  }

  model Location {
    id: Int @id
    city: String
  }

  enum Tree {
    ARBORVITAE
    YELLOWBIRCH
    BLACKASH
    DOUGLASFIR
    OAK
  }

  enum Permission {
    ADMIN
    USER
    OWNER
    COLLABORATOR
  }
`
