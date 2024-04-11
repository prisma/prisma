export type Datamodel = string | Array<[filename: string, data: string]>

// Convert a datamodel to a string for debugging purposes.
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export const schemaToStringDebug = (datamodel: Datamodel | unknown): string | undefined => {
  if (datamodel === undefined) {
    return undefined
  }

  if (typeof datamodel === 'string') {
    return datamodel
  }

  if (Array.isArray(datamodel)) {
    return datamodel.map(([filename, data]) => `// @prisma Schema file:${filename}\n\n${data}`).join('\n')
  }

  return String(datamodel)
}
