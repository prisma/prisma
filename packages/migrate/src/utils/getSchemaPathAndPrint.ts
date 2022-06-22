import { getSchemaPath, logger } from '@prisma/internals'
import chalk from 'chalk'
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
export async function getSchemaPathAndPrint(schemaPathProvided?: string, postinstallCwd?: string) {
  const cwdOptions = postinstallCwd ? { cwd: postinstallCwd } : undefined
  const schemaPath = await getSchemaPath(schemaPathProvided, cwdOptions)
  if (!schemaPath) {
    // Special case for Generate command
    if (postinstallCwd) {
      logger.warn(`The postinstall script automatically ran \`prisma generate\` and did not find your \`prisma/schema.prisma\`.
If you have a Prisma schema file in a custom path, you will need to run
\`prisma generate --schema=./path/to/your/schema.prisma\` to generate Prisma Client.
If you do not have a Prisma schema file yet, you can ignore this message.`)
      return ''
    }

    throw new NoSchemaFoundError()
  }

  console.info(chalk.dim(`Prisma schema loaded from ${path.relative(process.cwd(), schemaPath)}`))

  return schemaPath
}
