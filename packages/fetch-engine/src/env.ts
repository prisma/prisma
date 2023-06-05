import Debug from '@prisma/debug'
import fs from 'fs'
import { bold, underline } from 'kleur/colors'
import path from 'path'

import { BinaryType } from './BinaryType'

const debug = Debug('prisma:fetch-engine:env')

export const engineEnvVarMap = {
  [BinaryType.QueryEngineBinary]: 'PRISMA_QUERY_ENGINE_BINARY',
  [BinaryType.QueryEngineLibrary]: 'PRISMA_QUERY_ENGINE_LIBRARY',
  [BinaryType.MigrationEngineBinary]: 'PRISMA_SCHEMA_ENGINE_BINARY',
}

export function getBinaryEnvVarPath(binaryName: BinaryType): string | null {
  const envVar = engineEnvVarMap[binaryName]
  if (envVar && process.env[envVar]) {
    const envVarPath = path.resolve(process.cwd(), process.env[envVar] as string)
    if (!fs.existsSync(envVarPath)) {
      throw new Error(
        `Env var ${bold(envVar)} is provided but provided path ${underline(process.env[envVar]!)} can't be resolved.`,
      )
    }
    debug(
      `Using env var ${bold(envVar)} for binary ${bold(binaryName)}, which points to ${underline(
        process.env[envVar]!,
      )}`,
    )
    return envVarPath
  }

  return null
}
