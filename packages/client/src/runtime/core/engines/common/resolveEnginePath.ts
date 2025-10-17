import { Debug } from '@prisma/debug'
import { getEnginesPath } from '@prisma/engines'
import { BinaryTarget, getBinaryTargetForCurrentPlatform } from '@prisma/get-platform'
import { ClientEngineType } from '@prisma/internals'
import fs from 'fs'
import path from 'path'

import { PrismaClientInitializationError } from '../../errors/PrismaClientInitializationError'
import { EngineConfig } from './Engine'
import { bundlerHasTamperedWithEngineCopy } from './errors/engine-not-found/bundlerHasTamperedWithEngineCopy'
import { EngineNotFoundErrorInput } from './errors/engine-not-found/EngineNotFoundErrorInput'
import { toolingHasTamperedWithEngineCopy } from './errors/engine-not-found/toolingHasTamperedWithEngineCopy'

const debug = Debug('prisma:client:engines:resolveEnginePath')

// this name will be injected by esbuild when we build/bundle the runtime
const runtimeFileRegex = () => new RegExp(`runtime[\\\\/]${TARGET_BUILD_TYPE}\\.m?js$`)

/**
 * Resolves the path of the engine and config. If the engine could not be
 * found, we will try to help the user by providing helpful error messages.
 * @param engineType
 * @param config
 * @returns
 */
export async function resolveEnginePath(engineType: ClientEngineType, config: EngineConfig) {
  // if the user provided a custom path, or if engine previously found
  const prismaPath = config.prismaPath

  if (prismaPath !== undefined) return prismaPath

  // otherwise we will search to find the nearest query engine file
  const { enginePath, searchedLocations } = await findEnginePath(engineType, config)

  debug('enginePath', enginePath)

  // if we find it, cache and return
  if (enginePath !== undefined) return (config.prismaPath = enginePath)

  // if we don't find it, then we will throw helpful error messages
  const binaryTarget = await getBinaryTargetForCurrentPlatform()
  const clientHasBeenBundled = __filename.match(runtimeFileRegex()) === null // runtime name

  const errorInput: EngineNotFoundErrorInput = {
    searchedLocations,
    generator: config.generator!,
    runtimeBinaryTarget: binaryTarget,
    queryEngineName: getQueryEngineName(engineType, binaryTarget),
    expectedLocation: path.relative(process.cwd(), config.dirname), // TODO pathToPosix
    errorStack: new Error().stack,
  }

  let errorMessage: string
  if (clientHasBeenBundled) {
    errorMessage = bundlerHasTamperedWithEngineCopy(errorInput)
  } else {
    errorMessage = toolingHasTamperedWithEngineCopy(errorInput)
  }

  throw new PrismaClientInitializationError(errorMessage, config.clientVersion!)
}

/**
 * Core logic for the resolution of the engine path. This function will search
 * for the engine in multiple locations, and return the first one that is found.
 * @param engineType
 * @param config
 * @returns
 */
async function findEnginePath(engineType: ClientEngineType, config: EngineConfig) {
  const binaryTarget = await getBinaryTargetForCurrentPlatform()
  const searchedLocations: string[] = []

  const searchLocations: string[] = [
    config.dirname, // generation directory
    path.resolve(__dirname, '..'), // generation directory one level up
    config.generator?.output?.value ?? __dirname, // custom generator local path
    path.resolve(__dirname, '../../../.prisma/client'), // dot prisma node_modules ???
    '/tmp/prisma-engines', // used for netlify
    config.cwd, // cwdPath, not cwd
  ]

  if (__filename.includes('resolveEnginePath')) {
    searchLocations.push(getEnginesPath()) // for old tests
  }

  for (const location of searchLocations) {
    const engineName = getQueryEngineName(engineType, binaryTarget)
    const enginePath = path.join(location, engineName)

    searchedLocations.push(location)
    if (fs.existsSync(enginePath)) {
      return { enginePath, searchedLocations }
    }
  }

  return { enginePath: undefined, searchedLocations }
}

/**
 * Utility function to get the name of the query engine file for a given binary target.
 * @param engineType
 * @param binaryTarget
 * @returns
 */
export function getQueryEngineName(engineType: ClientEngineType, binaryTarget: BinaryTarget) {
  const extension = binaryTarget === 'windows' ? '.exe' : ''
  return `query-engine-${binaryTarget}${extension}`
}
