import Debug from '@prisma/debug'
import type { NodeAPILibraryTypes } from '@prisma/engine-core'
import { getCliQueryEngineBinaryType } from '@prisma/engines'
import { BinaryType } from '@prisma/fetch-engine'
import type { DataSource, GeneratorConfig } from '@prisma/generator-helper'
import { isNodeAPISupported } from '@prisma/get-platform'
import chalk from 'chalk'
import execa, { ExecaError } from 'execa'
import * as E from 'fp-ts/Either'
import { identity, pipe } from 'fp-ts/lib/function'
import * as TE from 'fp-ts/TaskEither'
import fs from 'fs'
import tmpWrite from 'temp-write'
import { match } from 'ts-pattern'
import { promisify } from 'util'

import { ErrorArea, isExecaErrorCausedByRustPanic, RustPanic } from '../panic'
import { resolveBinary } from '../resolveBinary'
import { load } from '../utils/load'

const debug = Debug('prisma:getConfig')

const unlink = promisify(fs.unlink)

const MAX_BUFFER = 1_000_000_000

export interface ConfigMetaFormat {
  datasources: DataSource[] | []
  generators: GeneratorConfig[] | []
  warnings: string[] | []
}

export type GetConfigOptions = {
  datamodel: string
  cwd?: string
  prismaPath?: string
  datamodelPath?: string
  retry?: number
  ignoreEnvVarErrors?: boolean
}
export class GetConfigError extends Error {
  constructor(message: string) {
    super(chalk.redBright.bold('Get config: ') + message)
  }
}

export async function getConfig(options: GetConfigOptions): Promise<ConfigMetaFormat> {
  const cliEngineBinaryType = getCliQueryEngineBinaryType()
  let data: ConfigMetaFormat | undefined
  if (cliEngineBinaryType === BinaryType.libqueryEngine) {
    data = await getConfigNodeAPI(options)
  } else {
    data = await getConfigBinaryFP(options)
  }
  return data
}

async function getConfigNodeAPI(options: GetConfigOptions): Promise<ConfigMetaFormat> {
  const queryEnginePath = await resolveBinary(BinaryType.libqueryEngine, options.prismaPath)
  await isNodeAPISupported()
  debug(`Using CLI Query Engine (Node-API Library) at: ${queryEnginePath}`)

  try {
    const NodeAPIQueryEngineLibrary = load<NodeAPILibraryTypes.Library>(queryEnginePath)
    if (process.env.FORCE_PANIC_QUERY_ENGINE_GET_CONFIG) {
      // cause a Rust panic
      await NodeAPIQueryEngineLibrary.debugPanic('FORCE_PANIC_QUERY_ENGINE_GET_CONFIG')
    }

    const data: ConfigMetaFormat = await NodeAPIQueryEngineLibrary.getConfig({
      datamodel: options.datamodel,
      datasourceOverrides: {},
      ignoreEnvVarErrors: options.ignoreEnvVarErrors ?? false,
      env: process.env,
    })
    return data
  } catch (e: any) {
    // TODO: if e.is_panic is true, throw a RustPanic error
    console.log('e@getConfigNodeAPI', JSON.stringify(JSON.parse(e)))
    console.log('\n\n')

    let error
    try {
      error = JSON.parse(e.message)
    } catch {
      throw e
    }
    let message: string
    if (error.error_code === 'P1012') {
      message = chalk.redBright(`Schema Parsing ${error.error_code}\n\n`) + error.message + '\n'
    } else {
      message = chalk.redBright(`${error.error_code}\n\n`) + error
    }
    throw new GetConfigError(message)
  }
}

async function getConfigBinaryFP(options: GetConfigOptions) {
  /**
   * Perform side effects to retrieve variables and metadata that may be useful in the main pipeline's
   * error handling.
   */
  const preliminaryEither = await pipe(
    TE.Do,
    TE.bind('queryEnginePath', () => {
      return TE.tryCatch(
        () => resolveBinary(BinaryType.queryEngine, options.prismaPath),
        (e) => ({
          type: 'query-engine-unresolved',
          reason: 'Unable to resolve path to query-engine binary',
          error: e,
        }),
      )
    }),
    TE.bind('tempDatamodelPath', ({ queryEnginePath }) => {
      debug(`Using CLI Query Engine (Binary) at: ${queryEnginePath}`)

      if (!options.datamodelPath) {
        return TE.tryCatch(
          () => tmpWrite(options.datamodel),
          (e) => ({
            type: 'datamodel-write',
            reason: 'Unable to write temp data model path',
            error: e,
          }),
        )
      }

      return TE.right(undefined as string | undefined)
    }),
  )()
  if (E.isLeft(preliminaryEither)) {
    const { reason, error } = preliminaryEither.left

    // TODO: is there an existing way of embedding the error in GetConfigError?
    throw new GetConfigError(reason)
  }
  const { queryEnginePath, tempDatamodelPath } = preliminaryEither.right

  const pipeline = pipe(
    TE.Do,
    TE.bind('result', () => {
      const execaOptions = {
        cwd: options.cwd,
        env: {
          PRISMA_DML_PATH: options.datamodelPath ?? tempDatamodelPath,
          RUST_BACKTRACE: '1',
        },
        maxBuffer: MAX_BUFFER,
      }

      const engineArgs = []
      const args = options.ignoreEnvVarErrors ? ['--ignoreEnvVarErrors'] : []

      if (process.env.FORCE_PANIC_QUERY_ENGINE_GET_CONFIG) {
        return TE.tryCatch(
          () =>
            execa(
              queryEnginePath,
              [...engineArgs, 'cli', 'debug-panic', '--message', 'FORCE_PANIC_QUERY_ENGINE_GET_CONFIG'],
              execaOptions,
            ),
          (e) => ({
            type: 'execa',
            reason: 'Error while interacting with query-engine binary',
            error: e,
          }),
        )
      }

      return TE.tryCatch(
        () => execa(queryEnginePath, [...engineArgs, 'cli', 'get-config', ...args], execaOptions),
        (e) => ({
          type: 'execa',
          reason: 'Error while interacting with query-engine binary',
          error: e,
        }),
      )
    }),
    TE.bind('data', ({ result }) => {
      return pipe(
        E.tryCatch(
          () => JSON.parse(result.stdout) as ConfigMetaFormat,
          (e) => ({
            type: 'parse-json',
            reason: 'Unable to parse JSON',
            error: e,
          }),
        ),
        TE.fromEither,
      )
    }),
  )

  const configEither = await pipeline()
  if (E.isRight(configEither)) {
    const { data } = configEither.right

    // TODO: we may want to show a warning in case we're not able to delete a temporary path
    const unlinkEither = await TE.tryCatch(
      () => unlink(tempDatamodelPath),
      (e) => ({
        type: 'unlink-temp-datamodel-path',
        reason: 'Unable to delete temporary datamodel path',
        error: e,
      }),
    )()

    return data
  }

  const error: RustPanic | GetConfigError = match(configEither.left)
    .with({ type: 'execa' }, ({ error, reason }) => {
      const e = error as ExecaError

      /**
       * Capture and propagate possible Rust panics.
       */
      if (isExecaErrorCausedByRustPanic(e as execa.ExecaError)) {
        return new RustPanic(
          /* message */ e.shortMessage, // Command failed with exit code 101: ~/query-engine1.x cli debug-panic --message FORCE_PANIC_QUERY_ENGINE_GET_DMMF
          /* rustStack */ e.stderr, // thread 'main' panicked at 'FORCE_PANIC_QUERY_ENGINE_GET_DMMF', /root/build/query-engine/query-engine/src/cli.rs:95:21
          /* request */ 'query-engine get-config',
          ErrorArea.QUERY_CLI,
          /* schemaPath */ options.datamodelPath ?? tempDatamodelPath,
          /* schema */ undefined,
        )
      }

      /**
       * Extract the actual error by attempting to JSON-parse the output of the query-engine binary.
       */
      const errorOutput = e.stderr ? e.stderr : e.stdout
      const actualError = pipe(
        E.tryCatch(
          () => JSON.parse(errorOutput),
          () => new GetConfigError(errorOutput),
        ),
        E.map((jsonError) => {
          let message = `${chalk.redBright(jsonError.message)}\n`
          if (jsonError.error_code) {
            if (jsonError.error_code === 'P1012') {
              message = chalk.redBright(`Schema Parsing ${jsonError.error_code}\n\n`) + message
            } else {
              message = chalk.redBright(`${jsonError.error_code}\n\n`) + message
            }
          }

          return new GetConfigError(message)
        }),
        E.getOrElse(identity),
      )
      return actualError
    })
    .otherwise(({ error, reason }) => {
      return new GetConfigError(reason)
    })

  throw error
}

// TODO Rename datamodelPath to schemaPath
async function getConfigBinary(options: GetConfigOptions): Promise<ConfigMetaFormat> {
  const queryEnginePath = await resolveBinary(BinaryType.queryEngine, options.prismaPath)
  debug(`Using CLI Query Engine (Binary) at: ${queryEnginePath}`)

  // If we do not get the path we write the datamodel to a tmp location
  let tempDatamodelPath: string | undefined
  if (!options.datamodelPath) {
    try {
      tempDatamodelPath = await tmpWrite(options.datamodel!)
    } catch (err) {
      throw new GetConfigError('Unable to write temp data model path')
    }
  }

  try {
    const execaOptions = {
      cwd: options.cwd,
      env: {
        PRISMA_DML_PATH: options.datamodelPath ?? tempDatamodelPath,
        RUST_BACKTRACE: '1',
      },
      maxBuffer: MAX_BUFFER,
    }

    const engineArgs = []
    const args = options.ignoreEnvVarErrors ? ['--ignoreEnvVarErrors'] : []

    if (process.env.FORCE_PANIC_QUERY_ENGINE_GET_CONFIG) {
      await execa(
        queryEnginePath,
        [...engineArgs, 'cli', 'debug-panic', '--message', 'FORCE_PANIC_QUERY_ENGINE_GET_CONFIG'],
        execaOptions,
      )
    }

    const result = await execa(queryEnginePath, [...engineArgs, 'cli', 'get-config', ...args], execaOptions)

    // NOTE: in case of a panic, the tempDatamodelPath is never unlinked
    if (tempDatamodelPath) {
      await unlink(tempDatamodelPath)
    }

    const data: ConfigMetaFormat = JSON.parse(result.stdout)
    return data
  } catch (e: any) {
    if (isExecaErrorCausedByRustPanic(e as execa.ExecaError)) {
      throw new RustPanic(
        /* message */ e.shortMessage, // Command failed with exit code 101: ~/query-engine1.x cli debug-panic --message FORCE_PANIC_QUERY_ENGINE_GET_DMMF
        /* rustStack */ e.stderr, // thread 'main' panicked at 'FORCE_PANIC_QUERY_ENGINE_GET_DMMF', /root/build/query-engine/query-engine/src/cli.rs:95:21
        /* request */ 'query-engine get-config',
        ErrorArea.QUERY_CLI,
        /* schemaPath */ options.datamodelPath ?? tempDatamodelPath,
        /* schema */ undefined,
      )
    }

    if (e.stderr || e.stdout) {
      // NOTE: there is a typo ("e.stout" rather than "e.stdout"), apparently we never captured the stdout in the execa call.
      // I also believe that the "if (e.stderr || e.stdout)" was only use to understand whether the error was thrown by execa or not.
      const error = e.stderr ? e.stderr : e.stout
      let jsonError, message
      try {
        jsonError = JSON.parse(error)
        message = `${chalk.redBright(jsonError.message)}\n`
        if (jsonError.error_code) {
          if (jsonError.error_code === 'P1012') {
            message = chalk.redBright(`Schema Parsing ${jsonError.error_code}\n\n`) + message
          } else {
            message = chalk.redBright(`${jsonError.error_code}\n\n`) + message
          }
        }
      } catch (e) {
        // if JSON parse / pretty handling fails, fallback to simple printing
        throw new GetConfigError(error)
      }

      throw new GetConfigError(message)
    }

    throw new GetConfigError(e)
  }
}
