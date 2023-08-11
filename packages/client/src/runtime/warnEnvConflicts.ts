import { tryLoadEnvs } from '@prisma/internals'

export function warnEnvConflicts(envPaths) {
  tryLoadEnvs(envPaths, { conflictCheck: 'warn' })
}
