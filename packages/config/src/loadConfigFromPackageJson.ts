import { readFile } from 'node:fs/promises'
import process from 'node:process'

import { Schema as Shape } from 'effect'
import { up } from 'empathic/package'

/**
 * Example:
 * ```json
 * {
 *   "schema": "./prisma/schema.prisma",
 *   "seed": "tsx ./prisma/seed.ts"
 * }
 * ```
 */
export type PrismaConfigPackageJson = {
  schema?: string
  seed?: string
}

export const PrismaConfigPackageJsonShape = Shape.Struct({
  schema: Shape.optional(Shape.String),
  seed: Shape.optional(Shape.NonEmptyString),
})

/**
 * User's Prisma configuration should live in `prisma.config.ts` instead of `package.json#prisma`.
 * See: https://pris.ly/prisma-config.
 *
 * This function returns `null` if no `package.json` is found, or if the `prisma` property is not defined therein.
 *
 * TODO: remove in Prisma 7.
 * @deprecated
 */
export async function loadConfigFromPackageJson(cwd: string = process.cwd()): Promise<{
  config: PrismaConfigPackageJson
  loadedFromFile: string
} | null> {
  const pkgPath = up({ cwd })

  if (pkgPath === undefined) {
    return null
  }

  const pkgJson = await readFile(pkgPath, { encoding: 'utf-8' }).then((p) => JSON.parse(p))

  /**
   * We're purposedly avoiding parsing `package.json#prisma` as `PrismaConfigPackageJsonShape` here,
   * as this code path may be hit by users who have not migrated to the new Prisma config file yet,
   * and the old way of configuring Prisma in `package.json#prisma` is more permissive that our parser allows.
   * In practice, we duck-type it to preserve backwards compatibility.
   */
  const deprecatedConfig = pkgJson['prisma'] as PrismaConfigPackageJson | undefined

  // No `prisma` property in `package.json`
  if (deprecatedConfig === undefined) {
    return null
  }

  // We avoid accidentally emitting deprecation warnings when the `prisma` property in package.json is
  // ```json
  // {
  //   "prisma": {
  //     "prismaCommit": "placeholder-for-commit-hash-replaced-during-publishing-in-publish-ts"
  //   }
  // }
  // ```
  // which is the case in `packages/cli/package.json` only.
  if (Object.keys(deprecatedConfig).length === 1 && deprecatedConfig['prismaCommit'] !== undefined) {
    return null
  }

  return {
    config: deprecatedConfig,
    loadedFromFile: pkgPath,
  }
}
