export const chinook = /* GraphQL */ `
model Album {
  id: Int @id @db(name:"AlbumId")
  Title: String
  Artist: Artist @db(name:"ArtistId")
  Tracks: Track[]
}

model Track {
  id: Int @id @db(name:"TrackId")
  Name: String
  Album: Album? @db(name: "AlbumId")
  AlbumId: Int?
  Mediamodel: Mediamodel @db(name: "MediamodelId")
  Genre: Genre? @db(name: "GenreId")
  Composer: String?
  Milliseconds: Int
  UnitPrice: Float
  Playlists: PlaylistTrack[]
  InvoiceLines: InvoiceLine[]
}

model Mediamodel {
  id: Int @id @db(name:"MediamodelId")
  Name: String?
}

model Genre {
  id: Int @id @db(name:"GenreId")
  Name: String?
  Tracks: Track[]
}

model Artist {
  id: Int @id @db(name:"ArtistId")
  Name: String?
  Albums: Album[]
}

model Customer {
  id: Int @id @db(name:"CustomerId")
  FirstName: String
  LastName: String
  Company: String?
  Address: String?
  City: String?
  State: String?
  Country: String?
  PostalCode: String?
  Phone: String?
  Fax: String?
  Email: String
  SupportRep: Employee? @db(name: "SupportRepId")
  Invoices: Invoice[]
}

model Employee {
  id: Int @id @db(name:"EmployeeId")
  FirstName: String
  LastName: String
  Title: String?
  BirthDate: DateTime?
  HireDate: DateTime?
  Address: String?
  City: String?
  State: String?
  Country: String?
  PostalCode: String?
  Phone: String?
  Fax: String?
  Email: String?
  Customers: Customer[]
}

model Invoice {
  id: Int @id @db(name:"InvoiceId")
  Customer: Customer @db(name: "CustomerId")
  InvoiceDate: DateTime
  BillingAddress: String?
  BillingCity: String?
  BillingState: String?
  BillingCountry: String?
  BillingPostalCode: String?
  Total: Float
  Lines: InvoiceLine[]
}

model InvoiceLine {
  id: Int @id @db(name:"InvoiceLineId")
  Invoice: Invoice @db(name: "InvoiceId")
  Track: Track @db(name: "TrackId")
  UnitPrice: Float
  Quantity: Int
}

model Playlist {
  id: Int @id @db(name:"PlaylistId")
  Name: String?
  Tracks: PlaylistTrack[]
}

model PlaylistTrack {
  id: Int @id
  Playlist: Playlist @db(name: "PlaylistId")
  Track: Track @db(name: "TrackId")
}
`
