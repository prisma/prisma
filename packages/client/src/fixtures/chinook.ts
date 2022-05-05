export const chinook = /* Prisma */ `
datasource db {
  provider = "postgresql"
  url      = "postgresql://localhost:5432/db"
}

model Album {
  id       Int     @id @map("AlbumId")
  Title    String
  ArtistId Int
  Artist   Artist  @relation(fields: [ArtistId], references: [id])
  Tracks   Track[]
}

model Track {
  id           Int             @id @map("TrackId")
  Name         String
  Album        Album?          @relation(fields: [AlbumId], references: [id])
  AlbumId      Int?
  Mediamodel   Mediamodel      @relation(fields: [MediamodelId], references: [id])
  MediamodelId Int
  Genre        Genre?          @relation(fields: [GenreId], references: [id])
  GenreId      Int?
  Composer     String?
  Milliseconds Int
  UnitPrice    Float
  Playlists    PlaylistTrack[]
  InvoiceLines InvoiceLine[]
}

model Mediamodel {
  id    Int     @id @map("MediamodelId")
  Name  String?
  Track Track[]
}

model Genre {
  id     Int     @id @map("GenreId")
  Name   String?
  Tracks Track[]
}

model Artist {
  id     Int     @id @map("ArtistId")
  Name   String?
  Albums Album[]
}

model Customer {
  id           Int       @id @map("CustomerId")
  FirstName    String
  LastName     String
  Company      String?
  Address      String?
  City         String?
  State        String?
  Country      String?
  PostalCode   String?
  Phone        String?
  Fax          String?
  Email        String
  SupportRep   Employee? @relation(fields: [SupportRepId], references: [id])
  SupportRepId Int?
  Invoices     Invoice[]
}

model Employee {
  id         Int        @id @map("EmployeeId")
  FirstName  String
  LastName   String
  Title      String?
  BirthDate  DateTime?
  HireDate   DateTime?
  Address    String?
  City       String?
  State      String?
  Country    String?
  PostalCode String?
  Phone      String?
  Fax        String?
  Email      String?
  Customers  Customer[]
}

model Invoice {
  id                Int           @id @map("InvoiceId")
  Customer          Customer      @relation(fields: [CustomerId], references: [id])
  CustomerId        Int
  InvoiceDate       DateTime
  BillingAddress    String?
  BillingCity       String?
  BillingState      String?
  BillingCountry    String?
  BillingPostalCode String?
  Total             Float
  Lines             InvoiceLine[]
}

model InvoiceLine {
  id        Int     @id @map("InvoiceLineId")
  Invoice   Invoice @relation(fields: [InvoiceId], references: [id])
  InvoiceId Int
  Track     Track   @relation(fields: [TrackId], references: [id])
  TrackId   Int
  UnitPrice Float
  Quantity  Int
}

model Playlist {
  id     Int             @id @map("PlaylistId")
  Name   String?
  Tracks PlaylistTrack[]
}

model PlaylistTrack {
  id         Int      @id
  Playlist   Playlist @relation(fields: [PlaylistId], references: [id])
  PlaylistId Int
  Track      Track    @relation(fields: [TrackId], references: [id])
  TrackId    Int
}
`
