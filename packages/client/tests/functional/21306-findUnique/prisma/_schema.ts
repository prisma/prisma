import { idForProvider } from '../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
  return /* Prisma */ `
  generator client {
    provider = "prisma-client-js"
  }
  
  datasource db {
    provider = "${provider}"
    url      = env("DATABASE_URI_${provider}")
  }
  
  type Meme {
    one String 
    two String
  }

  model User {
    id ${idForProvider(provider)}
    meme Meme
    @@unique([meme.one, meme.two])
  }

  model UserUnique {
    id ${idForProvider(provider)}
    meme Meme @unique
  }
  `
})
