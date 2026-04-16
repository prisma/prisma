import testMatrix from '../_matrix'

export default testMatrix.setupSchema(() => {
  return /* Prisma */ `
    generator client {
      provider = "prisma-client-js"
    }

    datasource db {
      provider = "mysql"
    }

    model A {
      id Int @id @default(autoincrement())
    }
  `
})
