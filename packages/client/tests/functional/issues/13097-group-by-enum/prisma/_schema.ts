import { idForProvider } from '../../../_utils/idForProvider'
import { Providers } from '../../../_utils/providers'
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

    enum Enum {
      A
    }

    model Resource {
      id        ${idForProvider(provider)}
      enumValue Enum?
      ${provider !== Providers.MYSQL ? 'enumArray Enum[]' : ''}
    }
  `
})
