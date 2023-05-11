import { tryLoadEnvs } from '@prisma/internals'

export function warnEnvConflicts(envPaths) {
  NODE_CLIENT && tryLoadEnvs(envPaths, { conflictCheck: 'warn' })
}
