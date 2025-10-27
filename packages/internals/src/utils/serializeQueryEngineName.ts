/**
 * Normalize the snapshot messages related to the interaction with Query Engine.
 */
export function serializeQueryEngineName(message: string) {
  const normalizedName = 'query-engine-NORMALIZED'
  return message.replace(/query-engine-node-api library/g, normalizedName)
}
