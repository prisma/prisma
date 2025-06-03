import { ClientEngineType, getClientEngineType, loadSchemaContext } from '@prisma/internals'

type GetClientInfoFromSchemaInput = {
  schemaPathFromConfig?: string
  schemaPathFromArg?: string
}

type ClientInfo = {
  previewFeatures: string[]
  engineType: `${ClientEngineType}`
}

export async function getClientInfoFromSchema({
  schemaPathFromConfig,
  schemaPathFromArg,
}: GetClientInfoFromSchemaInput): Promise<ClientInfo> {
  const { generators } = await loadSchemaContext({
    schemaPathFromConfig,
    schemaPathFromArg,
    printLoadMessage: false,
  })

  const prismaClientGenerator = generators
    .filter(
      (g) => ['prisma-client-js', 'prisma-client'].includes(g.provider.value!), // if provider wasn't set, `prisma validate` would fail
    )
    .shift()

  const engineType = getClientEngineType(prismaClientGenerator)
  const previewFeatures = prismaClientGenerator?.previewFeatures ?? []

  return {
    previewFeatures,
    engineType,
  }
}
