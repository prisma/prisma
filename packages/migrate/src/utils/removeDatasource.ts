import { trimBlocksFromSchema } from '@prisma/internals'

export function removeDatasource(schema: string): string {
  return trimBlocksFromSchema(schema, ['datasource']).trim()
}
