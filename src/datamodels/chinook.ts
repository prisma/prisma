export const chinook = /* GraphQL */ `
  type Artist {
    id: ID! @id
    ArtistId: Int! @unique
    Name: String!
    Albums: [Album!]!
    someDate: DateTime!
    someOptionalDate: DateTime
  }

  type Album {
    id: ID! @id
    AlbumId: Int! @unique
    Title: String!
    Artist: Artist!
    Tracks: [Track!]!
  }

  type Track {
    id: ID! @id
    TrackId: Int! @unique
    Name: String!
    Album: Album!
    MediaType: MediaType!
    Genre: Genre!
    Composer: String
    Milliseconds: Int!
    Bytes: Int!
    UnitPrice: Float!
  }

  type Genre {
    id: ID! @id
    GenreId: Int! @unique
    Name: String!
    Tracks: [Track!]!
  }

  type MediaType {
    id: ID! @id
    MediaTypeId: Int! @unique
    Name: String!
    Tracks: [Track!]!
  }
`
