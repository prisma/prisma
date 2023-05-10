import { tryLoadEnvs } from '@prisma/internals'

export function warnEnvConflicts(envPaths) {
  if (NODE_CLIENT) {
    tryLoadEnvs(envPaths, { conflictCheck: 'warn' })
  }
}
