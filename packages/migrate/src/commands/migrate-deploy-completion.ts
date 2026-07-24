import { completionConfigPaths, completionSchemaPaths } from '@prisma/internals/src/cli/completion-values'
import type { CommandCompletion } from '@prisma/internals/src/cli/types'

export const migrateDeployCompletion: CommandCompletion = {
  name: 'migrate deploy',
  description: 'Apply pending migrations to the database',
  options: [
    { name: 'help', alias: 'h', description: 'Display this help message' },
    { name: 'schema', description: 'Custom path to your Prisma schema', values: completionSchemaPaths },
    { name: 'config', description: 'Custom path to your Prisma config file', values: completionConfigPaths },
    { name: 'no-hints', description: 'Hides the hint messages but still outputs errors and warnings' },
  ],
}
