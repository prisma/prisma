import type * as esbuild from 'esbuild'
import path from 'node:path'

type TsConfig = {
  compilerOptions?: {
    paths?: Record<string, string[]>
  }
  extends?: string
}

/**
 * Recursive function to resolve the paths config from a tsconfig.json, whether
 * it is in the config directly or via an inherited config (via "extends").
 * @param options
 * @param cwd
 * @returns
 */
function resolvePathsConfig(options: TsConfig, cwd: string) {
  if (options?.compilerOptions?.paths) {
    const paths = Object.entries(options.compilerOptions.paths)

    const resolvedPaths = paths.map(([key, paths]) => {
      return [key, paths.map((v) => path.resolve(cwd, v))] as const
    })

    return Object.fromEntries(resolvedPaths)
  }

  if (options.extends) {
    const extendsPath = path.resolve(cwd, options.extends)
    const extendsDir = path.dirname(extendsPath)
    const extendsConfig = require(extendsPath)

    return resolvePathsConfig(extendsConfig, extendsDir)
  }

  return []
}

/**
 * Forces `esbuild` to always use the TS compiler paths, even when we are
 * bundling a local dependency of a local dependency, ensuring maximum
 * tree-shaking. Note: `esbuild` has some support for this, though it is limited
 * in the amount of dependency nesting it supports.
 */
export const resolvePathsPlugin: esbuild.Plugin = {
  name: 'resolvePathsPlugin',
  setup(build) {
    const parentTsConfig = require(`${process.cwd()}/${build.initialOptions.tsconfig}`)
    const resolvedTsPaths = resolvePathsConfig(parentTsConfig, process.cwd())
    const packagesRegex = new RegExp(`^(${Object.keys(resolvedTsPaths).join('|')})$`)

    build.onResolve({ filter: packagesRegex }, (args) => {
      if (build.initialOptions.external?.includes(args.path)) {
        return { path: args.path, external: true }
      }

      return { path: `${resolvedTsPaths[args.path][0]}/index.ts` }
    })
  },
}
