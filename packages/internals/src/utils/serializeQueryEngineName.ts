/**
 * Normalize the snapshot messages related to the interaction with Query Engine.
 */
export function serializeQueryEngineName(message: string) {
  const normalizedName = 'query-engine-NORMALIZED'
  if (process.env.PRISMA_CLI_QUERY_ENGINE_TYPE === 'binary') {
    return message.replace(/query-engine binary/g, normalizedName)
  }

  // process.env.PRISMA_CLI_QUERY_ENGINE_TYPE is 'library' by default
  return message.replace(/query-engine-node-api library/g, normalizedName)
}
