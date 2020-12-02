import { tryLoadEnvs } from '@prisma/sdk/dist/utils/tryLoadEnvs'

export function warnEnvConflicts(envPaths) {
  tryLoadEnvs(envPaths, { conflictCheck: 'warn' })
}
