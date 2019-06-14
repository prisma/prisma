export const chinook = /* GraphQL */ `
datasource my_db {
  provider = "sqlite"
  url  = "file:db/migration_engine.db"
  default = true
}

model Album {
  id Int @id @map("AlbumId")
  Title String
  Artist Artist @map("ArtistId")
  Tracks Track[]
}

model Track {
  id Int @id @map("TrackId")
  Name String
  Album Album? @map("AlbumId")
  AlbumId Int?
  Mediamodel Mediamodel @map("MediamodelId")
  Genre Genre? @map("GenreId")
  Composer String?
  Milliseconds Int
  UnitPrice Float
  Playlists PlaylistTrack[]
  InvoiceLines InvoiceLine[]
}

model Mediamodel {
  id Int @id @map("MediamodelId")
  Name String?
}

model Genre {
  id Int @id @map("GenreId")
  Name String?
  Tracks Track[]
}

model Artist {
  id Int @id @map("ArtistId")
  Name String?
  Albums Album[]
}

model Customer {
  id Int @id @map("CustomerId")
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
  SupportRep Employee? @map("SupportRepId")
  Invoices Invoice[]
}

model Employee {
  id Int @id @map("EmployeeId")
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
  id Int @id @map("InvoiceId")
  Customer Customer @map("CustomerId")
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
  id Int @id @map("InvoiceLineId")
  Invoice Invoice @map("InvoiceId")
  Track Track @map("TrackId")
  UnitPrice Float
  Quantity Int
}

model Playlist {
  id Int @id @map("PlaylistId")
  Name String?
  Tracks PlaylistTrack[]
}

model PlaylistTrack {
  id Int @id
  Playlist Playlist @map("PlaylistId")
  Track Track @map("TrackId")
}
`
