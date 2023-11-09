import { tryLoadEnvs } from '@prisma/internals'

export function warnEnvConflicts(envPaths) {
  if (TARGET_BUILD_TYPE !== 'edge') {
    tryLoadEnvs(envPaths, { conflictCheck: 'warn' })
  }
}
