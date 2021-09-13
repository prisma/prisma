import { tryLoadEnvs } from '@prisma/sdk'

export function warnEnvConflicts(envPaths) {
  tryLoadEnvs(envPaths, { conflictCheck: 'warn' })
}
