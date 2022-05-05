export const saleBuyers = /* Prisma */ `
datasource db {
  provider = "postgresql"
  url      = "postgresql://localhost:5432/db"
}

generator client {
  provider  = "prisma-client-js"
  output    = "@prisma/client"
  transpile = false
}

model Buyer {
  id    String  @id @default(cuid())
  name  String?
  sales Sale[]  @relation("BuyersOnSale", references: [id])
}

model Sale {
  id     String    @id @default(cuid())
  date   DateTime?
  buyers Buyer[]   @relation("BuyersOnSale", references: [id])
}
`
