import crypto from 'crypto'

import { getSchemaWithPathOptional } from './getSchema'
import { arg } from './utils'

/**
 * Get a unique identifier for the project by hashing
 * the directory with `schema.prisma`
 */
export async function getProjectHash(): Promise<string> {
  const args = arg(process.argv.slice(3), { '--schema': String })

  const schemaPath = await getSchemaWithPathOptional(args['--schema'])
  // Default to cwd if the schema couldn't be found
  const projectPath = schemaPath?.schemaPath ?? process.cwd()

  return crypto.createHash('sha256').update(projectPath).digest('hex').substring(0, 8)
}

/**
 * Get a unique identifier for the CLI installation path
 * which can be either global or local (in project's node_modules)
 */
export function getCLIPathHash(): string {
  const cliPath = process.argv[1]
  return crypto.createHash('sha256').update(cliPath).digest('hex').substring(0, 8)
}
