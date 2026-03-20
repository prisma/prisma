import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
  return /* prisma */ `
    generator client {
      provider = "prisma-client-js"
      output   = "../generated/prisma/client"
    }
    
    datasource db {
      provider = "${provider}"
    }
    
    model Location {
      id       Int      @id @default(autoincrement())
      name     String
      position Geometry(Point, 4326)?
    }

    model LocationMercator {
      id       Int      @id @default(autoincrement())
      name     String
      position Geometry(Point, 3857)?
    }
    
    model Route {
      id    Int      @id @default(autoincrement())
      name  String
      path  Geometry(LineString, 4326)?
    }
    
    model Area {
      id       Int      @id @default(autoincrement())
      name     String
      boundary Geometry(Polygon, 4326)?
    }
  `
})
