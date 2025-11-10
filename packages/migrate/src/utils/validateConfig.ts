import { PrismaConfig, SchemaEngineConfigInternal } from '@prisma/config'
import type { RequireKey } from '@prisma/internals'
import { green, red } from 'kleur/colors'

class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigValidationError'
  }
}

/**
 * A Prisma Config that has been validated w.r.t. the command that is being executed.
 */
export type ValidatedPrismaConfig = RequireKey<PrismaConfig, 'datasource'>

function isValidPrismaConfig(prismaConfig: SchemaEngineConfigInternal): prismaConfig is ValidatedPrismaConfig {
  return prismaConfig.datasource !== undefined
}

type ValidateConfigInput = {
  config: Pick<PrismaConfig, 'datasource'>
  cmd: string
}

export function validateConfig({ config, cmd }: ValidateConfigInput): ValidatedPrismaConfig {
  if (!isValidPrismaConfig(config)) {
    throw new ConfigValidationError(
      `The ${red(`datasource`)} property is required in your Prisma config file when using ${green(`prisma ${cmd}`)}.`,
    )
  }

  return config
}
