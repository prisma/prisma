import { idForProvider } from '../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
  const id = idForProvider(provider)
  return /* Prisma */ `
    generator client {
      provider = "prisma-client-js"
    }

    datasource db {
      provider = "${provider}"
    }

    model Vote {
      id        ${id}
      value     Int
      item      Post | Comment @relation(fields: [itemId]) @polymorphic(discriminator: "itemType")
      itemId    String
      itemType  String
    }

    model Post {
      id    ${id}
      title String
    }

    model Comment {
      id   ${id}
      body String
    }
  `
})
