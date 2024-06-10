import { type GetSchemaResult, getSchemaWithPathOptional, link, logger } from '@prisma/internals'
import { dim } from 'kleur/colors'
import path from 'path'

import { NoSchemaFoundError } from './errors'

// TODO move NoSchemaFoundError to `@prisma/internals` and this too
// then replace the 2 hardcoded errors to NoSchemaFoundError in
// https://github.com/prisma/prisma/blob/bbdf1c23653a77b0b5bf7d62efd243dcebea018b/packages/sdk/src/cli/getSchema.ts#L383:L383

/**
 * If a path is provided checks that it exists or error
 * If no path provided check in default location(s) or error
 * Schema found: print to console it's relative path
 *
 * @returns {String} schemaPath
 */
export async function getSchemaPathAndPrint(schemaPathProvided?: string): Promise<GetSchemaResult>
export async function getSchemaPathAndPrint(
  schemaPathProvided?: string,
  postinstallCwd?: string,
): Promise<GetSchemaResult | null>
export async function getSchemaPathAndPrint(
  schemaPathProvided?: string,
  postinstallCwd?: string,
): Promise<GetSchemaResult | null> {
  const cwdOptions = postinstallCwd ? { cwd: postinstallCwd } : undefined
  const schemaPathResult = await getSchemaWithPathOptional(schemaPathProvided, cwdOptions)
  if (!schemaPathResult) {
    // Special case for Generate command: at the moment, it does not throw
    // on missing schema and instead prints the warning and exits with 0.
    // This is done because `generate` is also called from postinstall hook and
    // it needs to succeed even when the schema is not there. Future Prisma version
    // should do this ONLY for postinstall case and throw normal error for explicitly invoked
    // generate, however, for now, we are keeping warnings for both cases for backward compatibility
    if (cwdOptions !== undefined) {
      logger.warn(`We could not find your Prisma schema in the default locations (see: ${link(
        'https://pris.ly/d/prisma-schema-location',
      )}).
If you have a Prisma schema file in a custom path, you will need to run
\`prisma generate --schema=./path/to/your/schema.prisma\` to generate Prisma Client.
If you do not have a Prisma schema file yet, you can ignore this message.`)
      return null
    }

    throw new NoSchemaFoundError()
  }

  process.stdout.write(
    dim(`Prisma schema loaded from ${path.relative(process.cwd(), schemaPathResult.schemaPath)}`) + '\n',
  )

  return schemaPathResult
}
