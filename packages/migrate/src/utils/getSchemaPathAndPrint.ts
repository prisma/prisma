import {
  type GetSchemaOptions,
  type GetSchemaResult,
  getSchemaWithPath,
  type SchemaPathFromConfig,
} from '@prisma/internals'
import { dim } from 'kleur/colors'
import path from 'node:path'

// TODO move NoSchemaFoundError to `@prisma/internals` and this too
// then replace the 2 hardcoded errors to NoSchemaFoundError in
// https://github.com/prisma/prisma/blob/bbdf1c23653a77b0b5bf7d62efd243dcebea018b/packages/sdk/src/cli/getSchema.ts#L383:L383

/**
 * If a path is provided checks that it exists or error
 * If no path provided check in default location(s) or error
 * Schema found: print to console its relative path
 *
 * @returns {GetSchemaResult}
 */
export async function getSchemaPathAndPrint(
  schemaPathProvided?: string,
  schemaPathFromConfig?: SchemaPathFromConfig,
  options?: GetSchemaOptions,
): Promise<GetSchemaResult> {
  const schemaPathResult = await getSchemaWithPath(schemaPathProvided, schemaPathFromConfig, options)

  printSchemaLoadedMessage(schemaPathResult.schemaPath)

  return schemaPathResult
}

export function printSchemaLoadedMessage(schemaPath: string) {
  process.stdout.write(`${dim(`Prisma schema loaded from ${path.relative(process.cwd(), schemaPath)}`)}\n`)
}
