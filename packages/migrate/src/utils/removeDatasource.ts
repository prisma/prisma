import { trimBlocksFromSchema } from '@prisma/sdk'

export function removeDatasource(schema: string): string {
  return trimBlocksFromSchema(schema, ['datasource']).trim()
}
