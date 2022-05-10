export default ({ provider, id }) => {
  return /* Prisma */ `
    generator client {
      engineType = "binary"
      provider = "prisma-client-js"
    }
    
    datasource db {
      provider = "${provider}"
      url      = env("DATABASE_URI_${provider}")
    }
    
    model User {
      id ${id}
      name String
    }
  `
}
