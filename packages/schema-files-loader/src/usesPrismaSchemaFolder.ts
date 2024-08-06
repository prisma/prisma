// Minimal subset of the return type of `getConfig` from `@prisma/internals`, used for `usesPrismaSchemaFolder`.
// This is a simplified version of the actual `ConfigMetaFormat` type, which isn't imported to avoid circular dependencies.export
export type GetConfigResponse = {
  config: ConfigMetaFormat
}

export type ConfigMetaFormat = {
  generators: Array<{
    previewFeatures: string[]
  }>
}

export function usesPrismaSchemaFolder(config: ConfigMetaFormat): boolean {
  const previewFeatures = config.generators.find((g) => g.previewFeatures.length > 0)?.previewFeatures
  return (previewFeatures || []).includes('prismaSchemaFolder')
}
