import type { GeneratorConfig } from '@prisma/generator'
import { ClientEngineType, getClientEngineType, loadSchemaContext } from '@prisma/internals'

type GetClientInfoFromSchemaInput = {
  schemaPathFromConfig?: string
  schemaPathFromArg?: string
}

type ClientInfo = {
  previewFeatures: string[]
  engineType: `${ClientEngineType}`
}

export async function getClientGeneratorInfo({
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
      // if provider wasn't set, `prisma validate` would fail
      (g) => ['prisma-client-js', 'prisma-client'].includes(g.provider.value!),
    )
    .shift() satisfies GeneratorConfig | undefined

  const engineType = getClientEngineType(prismaClientGenerator)
  const previewFeatures = prismaClientGenerator?.previewFeatures ?? []

  return {
    previewFeatures,
    engineType,
  }
}
