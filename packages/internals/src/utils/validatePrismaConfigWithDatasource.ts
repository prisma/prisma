import { PrismaConfig, SchemaEngineConfigInternal } from '@prisma/config'
import { green, red } from 'kleur/colors'

import { type RequireKey } from '../types'
import { setClassName } from './setClassName'

export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message)
  }
}

setClassName(ConfigValidationError, 'ConfigValidationError')

/**
 * A Prisma Config that has been validated w.r.t. the command that is being executed.
 */
export type PrismaConfigWithDatasource = RequireKey<PrismaConfig, 'datasource'>

function isValidPrismaConfig(prismaConfig: SchemaEngineConfigInternal): prismaConfig is PrismaConfigWithDatasource {
  return prismaConfig.datasource !== undefined
}

type ValidateConfigInput = {
  config: Pick<PrismaConfig, 'datasource'>
  cmd: string
}

export function validatePrismaConfigWithDatasource({ config, cmd }: ValidateConfigInput): PrismaConfigWithDatasource {
  if (!isValidPrismaConfig(config)) {
    throw new ConfigValidationError(
      `The ${red(`datasource`)} property is required in your Prisma config file when using ${green(`prisma ${cmd}`)}.`,
    )
  }

  return config
}
