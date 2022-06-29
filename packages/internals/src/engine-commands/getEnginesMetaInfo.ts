import { getCliQueryEngineBinaryType } from '@prisma/engines'
import { BinaryType } from '@prisma/fetch-engine'
import * as E from 'fp-ts/Either'
import { pipe } from 'fp-ts/lib/function'
import * as O from 'fp-ts/Option'
import * as TE from 'fp-ts/TaskEither'
import fs from 'fs'
import path from 'path'
import { match, P } from 'ts-pattern'

import { engineEnvVarMap, safeResolveBinary } from '../resolveBinary'
import { safeGetEngineVersion } from './getEngineVersion'

/**
 * Both an engine binary and a library might be resolved from and environment variable indicating a path.
 * We first try to retrieve the engines' path from an env var; if it fails, we fall back to `safeResolveBinary`.
 * If both fail, we return an error.
 * Even if we resolve a path, retrieving the version might fail.
 */

export type EngineInfo = {
  fromEnvVar: O.Option<string>
  path: E.Either<Error, string>
  version: E.Either<Error, string>
}

export type BinaryMatrix<T> = {
  'query-engine': T
  'migration-engine': T
  'introspection-engine': T
  'format-binary': T
}

export type BinaryInfoMatrix = BinaryMatrix<EngineInfo>

export async function getEnginesMetaInfo() {
  const cliQueryEngineBinaryType = getCliQueryEngineBinaryType()

  const engines = [
    {
      name: 'query-engine' as const,
      type: cliQueryEngineBinaryType,
    },
    {
      name: 'migration-engine' as const,
      type: BinaryType.migrationEngine,
    },
    {
      name: 'introspection-engine' as const,
      type: BinaryType.introspectionEngine,
    },
    {
      name: 'format-binary' as const,
      type: BinaryType.prismaFmt,
    },
  ] as const

  /**
   * Resolve `resolveEngine` promises (that can never fail) and forward a reference to
   * the engine name in the promise result.
   */
  const enginePromises = engines.map(({ name, type }) => {
    return resolveEngine(type).then((result) => [name, result])
  })
  const engineMatrix: BinaryInfoMatrix = await Promise.all(enginePromises).then(Object.fromEntries)

  const engineDataAcc = engines.map(({ name }) => {
    const [engineInfo, errors] = getEnginesInfo(engineMatrix[name])
    return [{ [name]: engineInfo } as { [name in keyof BinaryInfoMatrix]: string }, errors] as const
  })

  // map each engine to its version
  const engineMetaInfo: {
    'query-engine': string
    'migration-engine': string
    'introspection-engine': string
    'format-binary': string
  }[] = engineDataAcc.map((arr) => arr[0])

  // keep track of any error that has occurred, if any
  const enginesMetaInfoErrors: Error[] = engineDataAcc.flatMap((arr) => arr[1])

  return [engineMetaInfo, enginesMetaInfoErrors] as const
}

export function getEnginesInfo(enginesInfo: EngineInfo): readonly [string, Error[]] {
  // if the engine is not found, or the version cannot be retrieved, keep track of the resulting errors.
  const errors = [] as Error[]

  // compute message displayed when an engine is resolved via env vars
  const resolved = match(enginesInfo)
    .with({ fromEnvVar: P.when(O.isSome) }, (_engineInfo) => {
      return `, resolved by ${_engineInfo.fromEnvVar.value}`
    })
    .otherwise(() => '')

  // compute absolute path of an engine, returning an error message and populating
  // `errors` if it fails
  const absolutePath = match(enginesInfo)
    .with({ path: P.when(E.isRight) }, (_engineInfo) => {
      return _engineInfo.path.right
    })
    .with({ path: P.when(E.isLeft) }, (_engineInfo) => {
      // the binary/library can't be found
      errors.push(_engineInfo.path.left)
      return 'E_CANNOT_RESOLVE_PATH' as const
    })
    .exhaustive()

  // compute version (git hash) of an engine, returning an error message and populating
  // `errors` if it fails
  const version = match(enginesInfo)
    .with({ version: P.when(E.isRight) }, (_engineInfo) => {
      return _engineInfo.version.right
    })
    .with({ version: P.when(E.isLeft) }, (_engineInfo) => {
      // the binary/library exists, but extracting the version failed
      errors.push(_engineInfo.version.left)
      return 'E_CANNOT_RESOLVE_VERSION_FROM_ENGINE' as const
    })
    .exhaustive()

  const versionMessage = `${version} (at ${path.relative(process.cwd(), absolutePath)}${resolved})`
  return [versionMessage, errors] as const
}

/**
 * An engine path read from the environment is valid only if it exists on disk.
 * @param pathFromEnv engine path read from process.env
 */
function isPathFromEnvValid(pathFromEnv: string | undefined): pathFromEnv is string {
  return !!pathFromEnv && fs.existsSync(pathFromEnv)
}

export async function resolveEngine(binaryName: BinaryType): Promise<EngineInfo> {
  const envVar = engineEnvVarMap[binaryName]
  const pathFromEnv = process.env[envVar]

  /**
   * Read the binary path, preferably from the environment, or resolving the canonical path
   * from the given `binaryName`.
   */

  const pathFromEnvOption: O.Option<string> = O.fromPredicate(isPathFromEnvValid)(pathFromEnv)

  const fromEnvVarOption: O.Option<string> = pipe(
    pathFromEnvOption,
    O.map(() => envVar),
  )

  const enginePathEither: E.Either<Error, string> = await pipe(
    pathFromEnvOption,
    O.fold(
      () => safeResolveBinary(binaryName),
      (_pathFromEnv) => TE.right(_pathFromEnv),
    ),
  )()

  /**
   * Read the version from the engine, but only if the enginePath is valid.
   */

  const versionEither: E.Either<Error, string> = await pipe(
    enginePathEither,
    TE.fromEither,
    TE.chain((enginePath) => {
      return safeGetEngineVersion(enginePath, binaryName)
    }),
  )()

  const engineInfo: EngineInfo = {
    path: enginePathEither,
    version: versionEither,
    fromEnvVar: fromEnvVarOption,
  }

  return engineInfo
}
