export const enums = /* GraphQL */ `
  type User {
    id: ID! @id
    name: String!
    email: String! @unique
    status: String
    nicknames: [String!]! @scalarList(strategy: RELATION)
    permissions: [Permission!]! @scalarList(strategy: RELATION)
    favoriteTree: Tree
    location: Location
  }

  type Location {
    id: Int! @id
    city: String!
  }

  enum Tree {
    Arborvitae
    YellowBirch
    BlackAsh
    DouglasFir
    Oak
  }

  enum Permission {
    ADMIN
    USER
    OWNER
    COLLABORATOR
  }
`
