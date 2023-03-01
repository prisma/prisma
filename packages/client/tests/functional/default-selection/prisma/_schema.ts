import { foreignKeyForProvider, idForProvider } from '../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
  const fields: string[] = []
  const declarations: string[] = []

  if (provider === 'postgresql' || provider === 'cockroachdb' || provider === 'mongodb') {
    fields.push('list String[]')
  }

  if (provider !== 'sqlite' && provider !== 'sqlserver') {
    declarations.push(/* Prisma */ `
    enum Enum {
      A
      B
    }`)

    fields.push('enum Enum')
  }

  if (provider === 'mongodb') {
    declarations.push(/* Prisma */ `
    type Composite {
      value String
    }
    `)
    fields.push('composite Composite')
  }

  return /* Prisma */ `
  generator client {
    provider = "prisma-client-js"
  }
  
  datasource db {
    provider = "${provider}"
    url      = env("DATABASE_URI_${provider}")
  }
  
  model Model {
    id ${idForProvider(provider)}
    value String
    otherId ${foreignKeyForProvider(provider)} @unique
    relation Other @relation(fields: [otherId], references: [id])
    ${fields.join('\n')}
  }

  model Other {
    id ${idForProvider(provider)}
    model Model?
  }

${declarations.join('\n')}

  `
})
