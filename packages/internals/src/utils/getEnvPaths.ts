import Debug from '@prisma/debug'
import { EnvPaths } from '@prisma/generator-helper'
import findUp from 'find-up'
import fs from 'fs'
import path from 'path'

import { getSchemaFromPackageJson } from '../cli/getSchema'
import { exists } from './tryLoadEnvs'

const debug = Debug('prisma:loadEnv')

/**
 *  1. Search in project root
 *  1. Schema
 *    1. Search location from schema arg `--schema`
 *    1. Search location from pkgJSON `"prisma": {"schema": "/path/to/schema.prisma"}`
 *    1. Search default location `./prisma/.env`
 *    1. Search cwd `./.env`
 *
 * @returns `{ rootEnvPath, schemaEnvPath }`
 */
export async function getEnvPaths(
  schemaPath?: string | null,
  opts: { cwd: string } = { cwd: process.cwd() },
): Promise<EnvPaths> {
  const rootEnvPath = getProjectRootEnvPath({ cwd: opts.cwd }) ?? null
  const schemaEnvPathFromArgs = schemaPathToEnvPath(schemaPath)
  // NOTE: We intentionally do NOT check based on the schema path from `prisma.config.ts` as having a
  // `prisma.config.ts` file disables automatic env loading anyway.
  const schemaEnvPathFromPkgJson = schemaPathToEnvPath(await readSchemaPathFromPkgJson())
  const schemaEnvPaths = [
    schemaEnvPathFromArgs, // 1 - Check --schema directory for .env
    schemaEnvPathFromPkgJson, // 2 - Check package.json schema directory for .env
    './prisma/.env', // 3 - Check ./prisma directory for .env
    './.env', // 4 - Check cwd for .env
  ]
  const schemaEnvPath = schemaEnvPaths.find(exists)
  return { rootEnvPath, schemaEnvPath }
}

async function readSchemaPathFromPkgJson(): Promise<string | null> {
  try {
    const pkgJsonSchema = await getSchemaFromPackageJson(process.cwd())
    if (pkgJsonSchema.ok) {
      pkgJsonSchema.schema.schemaPath
    }
    return null
  } catch {
    return null
  }
}

function getProjectRootEnvPath(opts: findUp.Options | undefined): string | null {
  const pkgJsonPath = findUp.sync((dir) => {
    const pkgPath = path.join(dir, 'package.json')
    if (findUp.sync.exists(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
        if (pkg['name'] !== '.prisma/client') {
          debug(`project root found at ${pkgPath}`)
          return pkgPath
        }
      } catch (e) {
        debug(`skipping package.json at ${pkgPath}`)
      }
    }

    return undefined
  }, opts)

  if (!pkgJsonPath) {
    return null
  }

  const candidate = path.join(path.dirname(pkgJsonPath), '.env')
  if (!fs.existsSync(candidate)) {
    return null
  }

  return candidate
}

function schemaPathToEnvPath(schemaPath: string | null | undefined) {
  if (!schemaPath) return null
  return path.join(path.dirname(schemaPath), '.env')
}
