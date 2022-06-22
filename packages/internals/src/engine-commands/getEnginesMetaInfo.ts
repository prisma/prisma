import { getCliQueryEngineBinaryType } from '@prisma/engines'
import { BinaryType } from '@prisma/fetch-engine'
import * as E from 'fp-ts/Either'
import { pipe } from 'fp-ts/lib/function'
import * as O from 'fp-ts/Option'
import * as T from 'fp-ts/Task'
import * as TE from 'fp-ts/TaskEither'
import fs from 'fs'
import path from 'path'
import { match, P } from 'ts-pattern'

import { engineEnvVarMap, safeResolveBinary } from '../resolveBinary'
import { safeGetBinaryVersion } from './getBinaryVersion'

export type EngineInfoLibrary = {
  libraryPath: O.Option<string>
  version: E.Either<Error, String>
  fromEnvVar: O.Option<string>
}

export type EngineInfoBinaryPathError = {
  binaryPath: E.Left<Error>
}

export type EngineInfoBinaryPathSuccess = {
  binaryPath: E.Right<string>
} & ({ version: E.Left<Error> } | { version: E.Right<string> })

export type EngineInfoBinary = EngineInfoBinaryPathError | EngineInfoBinaryPathSuccess

export type EngineInfo = EngineInfoLibrary | EngineInfoBinary

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
    const promise = resolveEngine(type)()
    return promise.then((result) => [name, result])
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

  const resolved = match(enginesInfo)
    .with({ fromEnvVar: P.when(O.isSome) }, (enginesInfoLibrary) => {
      return `, resolved by ${enginesInfoLibrary.fromEnvVar.value}`
    })
    .otherwise(() => '')

  const version = match(enginesInfo)
    .with({ version: P.when(E.isRight) }, (engineInfo) => {
      return engineInfo.version.right
    })
    .with({ version: P.when(E.isLeft) }, (engineInfo) => {
      errors.push(engineInfo.version.left)
      return 'E_CANNOT_RESOLVE_VERSION' as const
    })
    .otherwise(() => {
      return 'E_CANNOT_RESOLVE_VERSION' as const
    })

  const absolutePath = match(enginesInfo)
    .with({ libraryPath: P.when(O.isSome) }, (enginesInfoLibrary) => {
      return enginesInfoLibrary.libraryPath.value
    })
    .with({ libraryPath: P.when(O.isNone) }, (_) => {
      return 'E_CANNOT_RESOLVE_PATH' as const
    })
    .with({ binaryPath: P.when(E.isRight) }, (engineInfo) => {
      return engineInfo.binaryPath.right
    })
    .with({ binaryPath: P.when(E.isLeft) }, (engineInfo) => {
      errors.push(engineInfo.binaryPath.left)
      return 'E_CANNOT_RESOLVE_PATH' as const
    })
    .exhaustive()

  return [`${version} (at ${path.relative(process.cwd(), absolutePath)}${resolved})`, errors] as const
}

export function resolveEngine(binaryName: BinaryType): T.Task<EngineInfo> {
  const envVar = engineEnvVarMap[binaryName]
  const pathFromEnv = process.env[envVar]

  if (pathFromEnv && fs.existsSync(pathFromEnv)) {
    /**
     * Extract EngineInfo from a library engine
     */
    const rest = { libraryPath: O.fromNullable(pathFromEnv), fromEnvVar: O.fromNullable(envVar) }
    const engineInfoLibraryTask = pipe(
      safeGetBinaryVersion(pathFromEnv, binaryName),
      TE.matchW(
        (versionError) => ({ version: E.left(versionError), ...rest }),
        (version) => ({ version: E.right(version), ...rest }),
      ),
    )
    return engineInfoLibraryTask
  }

  /**
   * Extract EngineInfo from a binary engine
   */
  const engineInfoBinaryTask: T.Task<EngineInfoBinary> = pipe(
    safeResolveBinary(binaryName),
    TE.matchEW(
      (binaryPathError) => {
        const result = T.of({ binaryPath: E.left(binaryPathError) })
        return result as T.Task<EngineInfoBinaryPathError>
      },
      (binaryPath) => {
        const rest = { binaryPath: E.right(binaryPath) }
        const result = pipe(
          safeGetBinaryVersion(pathFromEnv, binaryName),
          TE.matchW(
            (versionError) => ({ version: E.left(versionError), ...rest }),
            (version) => ({ version: E.right(version), ...rest }),
          ),
        )
        return result as T.Task<EngineInfoBinaryPathSuccess>
      },
    ),
  )
  return engineInfoBinaryTask
}
