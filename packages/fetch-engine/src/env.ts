import Debug from '@prisma/debug'
import fs from 'fs'
import { bold, underline, yellow } from 'kleur/colors'
import path from 'path'

import { BinaryType } from './BinaryType'

const debug = Debug('prisma:fetch-engine:env')

export const engineEnvVarMap = {
  [BinaryType.QueryEngineBinary]: 'PRISMA_QUERY_ENGINE_BINARY',
  [BinaryType.QueryEngineLibrary]: 'PRISMA_QUERY_ENGINE_LIBRARY',
  [BinaryType.SchemaEngineBinary]: 'PRISMA_SCHEMA_ENGINE_BINARY',
}

export const deprecatedEnvVarMap: Partial<typeof engineEnvVarMap> = {
  [BinaryType.SchemaEngineBinary]: 'PRISMA_MIGRATION_ENGINE_BINARY',
}

type PathFromEnvValue = {
  path: string
  fromEnvVar: string
}

export function getBinaryEnvVarPath(binaryName: BinaryType): PathFromEnvValue | null {
  const envVar = getEnvVarToUse(binaryName)

  if (process.env[envVar]) {
    const envVarPath = path.resolve(process.cwd(), process.env[envVar]!)
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
    return {
      path: envVarPath,
      fromEnvVar: envVar,
    }
  }

  return null
}

function getEnvVarToUse(binaryType: BinaryType): string {
  const envVar = engineEnvVarMap[binaryType]
  const deprecatedEnvVar = deprecatedEnvVarMap[binaryType]

  if (deprecatedEnvVar && process.env[deprecatedEnvVar]) {
    if (process.env[envVar]) {
      console.warn(
        `${yellow('prisma:warn')} Both ${bold(envVar)} and ${bold(deprecatedEnvVar)} are specified, ${bold(
          envVar,
        )} takes precedence. ${bold(deprecatedEnvVar)} is deprecated.`,
      )
      return envVar
    } else {
      console.warn(
        `${yellow('prisma:warn')} ${bold(deprecatedEnvVar)} environment variable is deprecated, please use ${bold(
          envVar,
        )} instead`,
      )
      return deprecatedEnvVar
    }
  }

  return envVar
}

export function allEngineEnvVarsSet(binaries: string[]): boolean {
  for (const binaryType of binaries) {
    if (!getBinaryEnvVarPath(binaryType as BinaryType)) {
      return false
    }
  }

  return true
}
