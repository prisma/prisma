export const scalars = /* GraphQL */ `
  # type User {
  #   id: Int! @id
  #   name: String
  # }

  type House {
    id: ID! @id
    string: String
    bool: Boolean
    stringList: [String] @scalarList(strategy: RELATION)
    int: Int
    float: Float
    intList: [Int] @scalarList(strategy: RELATION)
    floatList: [Float] @scalarList(strategy: RELATION)
    date: DateTime

    stringReq: String!
    boolReq: Boolean!
    intReq: Int!
    floatReq: Float!
    dateReq: DateTime!
  }
`
