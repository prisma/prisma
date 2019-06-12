export const chinook = /* GraphQL */ `
datasource my_db {
  provider = "sqlite"
  url  = "file:db/migration_engine.db"
  default = true
}

model Album {
  id Int @id @db("AlbumId")
  Title String
  Artist Artist @db("ArtistId")
  Tracks Track[]
}

model Track {
  id Int @id @db("TrackId")
  Name String
  Album Album? @db("AlbumId")
  AlbumId Int?
  Mediamodel Mediamodel @db("MediamodelId")
  Genre Genre? @db("GenreId")
  Composer String?
  Milliseconds Int
  UnitPrice Float
  Playlists PlaylistTrack[]
  InvoiceLines InvoiceLine[]
}

model Mediamodel {
  id Int @id @db("MediamodelId")
  Name String?
}

model Genre {
  id Int @id @db("GenreId")
  Name String?
  Tracks Track[]
}

model Artist {
  id Int @id @db("ArtistId")
  Name String?
  Albums Album[]
}

model Customer {
  id Int @id @db("CustomerId")
  FirstName String
  LastName String
  Company String?
  Address String?
  City String?
  State String?
  Country String?
  PostalCode String?
  Phone String?
  Fax String?
  Email String
  SupportRep Employee? @db("SupportRepId")
  Invoices Invoice[]
}

model Employee {
  id Int @id @db("EmployeeId")
  FirstName String
  LastName String
  Title String?
  BirthDate DateTime?
  HireDate DateTime?
  Address String?
  City String?
  State String?
  Country String?
  PostalCode String?
  Phone String?
  Fax String?
  Email String?
  Customers Customer[]
}

model Invoice {
  id Int @id @db("InvoiceId")
  Customer Customer @db("CustomerId")
  InvoiceDate DateTime
  BillingAddress String?
  BillingCity String?
  BillingState String?
  BillingCountry String?
  BillingPostalCode String?
  Total Float
  Lines InvoiceLine[]
}

model InvoiceLine {
  id Int @id @db("InvoiceLineId")
  Invoice Invoice @db("InvoiceId")
  Track Track @db("TrackId")
  UnitPrice Float
  Quantity Int
}

model Playlist {
  id Int @id @db("PlaylistId")
  Name String?
  Tracks PlaylistTrack[]
}

model PlaylistTrack {
  id Int @id
  Playlist Playlist @db("PlaylistId")
  Track Track @db("TrackId")
}
`
