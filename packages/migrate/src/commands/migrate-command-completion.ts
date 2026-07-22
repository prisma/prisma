import { completionConfigPaths, completionSchemaPaths } from '@prisma/internals/src/cli/completion-values'
import type { CommandCompletion } from '@prisma/internals/src/cli/types'

export const migrateCompletion: CommandCompletion = {
  name: 'migrate',
  description: 'Migrate your database',
  options: [
    { name: 'help', alias: 'h', description: 'Display this help message' },
    { name: 'config', description: 'Custom path to your Prisma config file', values: completionConfigPaths },
    { name: 'schema', description: 'Custom path to your Prisma schema', values: completionSchemaPaths },
  ],
}
