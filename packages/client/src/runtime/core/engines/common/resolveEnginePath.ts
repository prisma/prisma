import Debug from '@prisma/debug'
import { getEnginesPath } from '@prisma/engines'
import { getNodeAPIName, getPlatform, Platform } from '@prisma/get-platform'
import { plusX } from '@prisma/internals'
import fs from 'fs'
import path from 'path'

import { PrismaClientInitializationError } from '../../errors/PrismaClientInitializationError'
import { EngineConfig } from './Engine'
import { binaryTargetsWasIncorrectlyPinned } from './errors/engine-not-found/binaryTargetsWasIncorrectlyPinned'
import { bundlerHasTamperedWithEngineCopy } from './errors/engine-not-found/bundlerHasTamperedWithEngineCopy'
import { EngineNotFoundErrorInput } from './errors/engine-not-found/EngineNotFoundErrorInput'
import { nativeGeneratedOnDifferentPlatform } from './errors/engine-not-found/nativeGeneratedOnDifferentPlatform'
import { toolingHasTamperedWithEngineCopy } from './errors/engine-not-found/toolingHasTamperedWithEngineCopy'

const debug = Debug('prisma:client:engines:resolveEnginePath')
const runtimeName = TARGET_ENGINE_TYPE === 'all' ? 'index' : TARGET_ENGINE_TYPE
const runtimeFileRegex = new RegExp(`${runtimeName}\\.m?js$`)

/**
 * Resolves the path of a given engine type (binary or library) and config. If
 * the engine could not be found, we will try to help the user by providing
 * helpful error messages.
 * @param engineType
 * @param config
 * @returns
 */
export async function resolveEnginePath(engineType: 'binary' | 'library', config: EngineConfig) {
  // if the user provided a custom path, or if engine previously found
  const prismaPath =
    {
      binary: process.env.PRISMA_QUERY_ENGINE_BINARY,
      library: process.env.PRISMA_QUERY_ENGINE_LIBRARY,
    }[engineType] ?? config.prismaPath

  if (prismaPath !== undefined) return prismaPath

  // otherwise we will search to find the nearest query engine file
  const { enginePath, searchedLocations } = await findEnginePath(engineType, config)

  debug('enginePath', enginePath)

  // if we find it, we apply +x chmod to the binary, cache, and return
  if (enginePath !== undefined && engineType === 'binary') plusX(enginePath)
  if (enginePath !== undefined) return (config.prismaPath = enginePath)

  // if we don't find it, then we will throw helpful error messages
  const binaryTarget = await getPlatform()
  const generatorBinaryTargets = config.generator?.binaryTargets ?? []
  const hasNativeBinaryTarget = generatorBinaryTargets.some((bt) => bt.native)
  const hasMissingBinaryTarget = !generatorBinaryTargets.some((bt) => bt.value === binaryTarget)
  const clientHasBeenBundled = __filename.match(runtimeFileRegex) === null // runtime name

  const errorInput: EngineNotFoundErrorInput = {
    searchedLocations,
    generatorBinaryTargets,
    generator: config.generator!,
    runtimeBinaryTarget: binaryTarget,
    queryEngineName: getQueryEngineName(engineType, binaryTarget),
    expectedLocation: path.relative(process.cwd(), config.dirname), // TODO pathToPosix
  }

  let errorMessage: string
  if (hasNativeBinaryTarget && hasMissingBinaryTarget) {
    errorMessage = nativeGeneratedOnDifferentPlatform(errorInput)
  } else if (hasMissingBinaryTarget) {
    errorMessage = binaryTargetsWasIncorrectlyPinned(errorInput)
  } else if (clientHasBeenBundled) {
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
async function findEnginePath(engineType: 'binary' | 'library', config: EngineConfig) {
  const binaryTarget = await getPlatform()
  const searchedLocations: string[] = []

  const dirname = eval('__dirname') as string
  const searchLocations: string[] = [
    config.dirname, // generation directory
    path.resolve(dirname, '..'), // generation directory one level up
    config.generator?.output?.value ?? dirname, // custom generator local path
    path.resolve(dirname, '../../../.prisma/client'), // dot prisma node_modules ???
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
 * Utility function to get the name of the query engine file for a given engine
 * and a given binary target.
 * @param engineType
 * @param binaryTarget
 * @returns
 */
export function getQueryEngineName(engineType: 'binary' | 'library', binaryTarget: Platform) {
  if (engineType === 'library') {
    return getNodeAPIName(binaryTarget, 'fs')
  } else {
    return `query-engine-${binaryTarget}${binaryTarget === 'windows' ? '.exe' : ''}`
  }
}
