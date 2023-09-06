import { computeSchemaHeader } from '../../../_utils/computeSchemaHeader'
import { idForProvider } from '../../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFlavor }): string => {
  const schemaHeader = computeSchemaHeader({
    provider,
    providerFlavor,
  })

  return /* Prisma */ `
${schemaHeader}

model Parent {
  id         ${idForProvider(provider)}
  resource   Resource @relation("Resource", fields: [resourceId], references: [id], onUpdate: NoAction)
  resourceId String @unique
}

model Resource {
  id          ${idForProvider(provider)}
  dependsOn   Resource? @relation("DependsOn", fields: [dependsOnId], references: [id], onUpdate: NoAction)
  dependsOnId String
  dependedOn  Resource[] @relation("DependsOn")
  parent      Parent? @relation("Resource")
}
`
})
