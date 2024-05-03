export type SingleSchema = string
export type MultipleSchemaTuple = [filename: string, content: string]
export type MultipleSchemas = Array<MultipleSchemaTuple>
export type SchemaFileInput = SingleSchema | MultipleSchemas

// Convert a datamodel to a string for debugging purposes.
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export const schemaToStringDebug = (schemaFileInput: SchemaFileInput | unknown): string | undefined => {
  if (schemaFileInput === undefined) {
    return undefined
  }

  if (typeof schemaFileInput === 'string') {
    return schemaFileInput
  }

  if (Array.isArray(schemaFileInput)) {
    return debugMultipleSchemas(schemaFileInput)
  }

  return String(schemaFileInput)
}

export function debugMultipleSchemas(multipleSchemas: MultipleSchemas): string {
  return multipleSchemas.map(([filename, content]) => `// @prisma Schema file:${filename}\n\n${content}`).join('\n')
}

export function debugMultipleSchemaPaths(multipleSchemas: MultipleSchemas): string {
  return multipleSchemas.map(([filename]) => filename).join(',\n')
}

export function extractSchemaContent(multipleSchemas: MultipleSchemas): string[] {
  return multipleSchemas.map(([, content]) => content)
}
