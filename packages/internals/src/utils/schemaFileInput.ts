export type SingleSchema = string
export type MultipleSchemaTuple = [filename: string, content: string]
export type MultipleSchemas = Array<MultipleSchemaTuple>
export type SchemaFileInput = SingleSchema | MultipleSchemas

export function extractSchemaContent(multipleSchemas: MultipleSchemas): string[] {
  return multipleSchemas.map(([, content]) => content)
}
