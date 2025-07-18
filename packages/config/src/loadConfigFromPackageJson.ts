import process from 'node:process'

import { Schema as Shape } from 'effect'

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
 * TODO: remove in Prisma 7.
 * @deprecated
 */
export async function loadConfigFromPackageJson(cwd: string = process.cwd()) {
  const { readPackageUp } = await import('read-package-up')
  const pkgJson = await readPackageUp({ cwd, normalize: false })

  /**
   * We're purposedly avoiding parsing `package.json#prisma` as `PrismaConfigPackageJsonShape` here,
   * as this code path may be hit by users who have not migrated to the new Prisma config file yet,
   * and the old way of configuring Prisma in `package.json#prisma` is more permissive that our parser allows.
   * In practice, we duck-type it to preserve backwards compatibility.
   */
  const prismaPropertyFromPkgJson = pkgJson?.packageJson?.prisma as PrismaConfigPackageJson | undefined

  if (!pkgJson) {
    return null
  }

  return {
    config: prismaPropertyFromPkgJson ?? {},
    loadedFromFile: pkgJson.path as string,
  }
}
