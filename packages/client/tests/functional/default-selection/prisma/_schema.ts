import { computeSchemaHeader } from '../../_utils/computeSchemaHeader'
import { foreignKeyForProvider, idForProvider } from '../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFlavor, previewFeatures }) => {
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

    if (provider !== 'mysql') {
      fields.push('enumList Enum[]')
    }
  }

  if (provider === 'mongodb') {
    declarations.push(/* Prisma */ `
    type Composite {
      value String
    }
    `)
    fields.push('composite Composite')
  }

  const schemaHeader = computeSchemaHeader({
    provider,
    providerFlavor,
    previewFeatures,
  })

  return /* Prisma */ `
  ${schemaHeader}

  
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
