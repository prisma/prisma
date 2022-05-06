import Debug from '@prisma/debug'
import type { NodeAPILibraryTypes } from '@prisma/engine-core'
import { getCliQueryEngineBinaryType } from '@prisma/engines'
import { BinaryType } from '@prisma/fetch-engine'
import type { DataSource, DMMF, GeneratorConfig } from '@prisma/generator-helper'
import { isNodeAPISupported } from '@prisma/get-platform'
import chalk from 'chalk'
import type { ExecaChildProcess, ExecaError, ExecaReturnValue } from 'execa'
import execa from 'execa'
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

const debug = Debug('prisma:getDMMF')

const unlink = promisify(fs.unlink)

const MAX_BUFFER = 1_000_000_000

export interface ConfigMetaFormat {
  datasources: DataSource[]
  generators: GeneratorConfig[]
  warnings: string[]
}

export type GetDMMFOptions = {
  datamodel?: string
  cwd?: string
  prismaPath?: string
  datamodelPath?: string
  retry?: number
  previewFeatures?: string[]
}

export class GetDmmfError extends Error {
  constructor(message: string) {
    super(chalk.redBright.bold('Get DMMF: ') + message)
  }
}

// TODO: add support for retry
export async function getDMMF(options: GetDMMFOptions): Promise<DMMF.Document> {
  warnOnDeprecatedFeatureFlag(options.previewFeatures)
  const cliEngineBinaryType = getCliQueryEngineBinaryType()
  const dmmf: DMMF.Document = await match(cliEngineBinaryType)
    .with(BinaryType.libqueryEngine, () => {
      return getDmmfNodeAPIFP(options)
    })
    .with(BinaryType.queryEngine, () => {
      return getDmmfBinaryFP(options)
    })
    .exhaustive()
  return dmmf
}

async function getDmmfNodeAPI(options: GetDMMFOptions): Promise<DMMF.Document> {
  const queryEnginePath = await resolveBinary(BinaryType.libqueryEngine, options.prismaPath)
  await isNodeAPISupported()
  debug(`Using CLI Query Engine (Node-API) at: ${queryEnginePath}`)

  try {
    const NodeAPIQueryEngineLibrary = load<NodeAPILibraryTypes.Library>(queryEnginePath)
    if (process.env.FORCE_PANIC_QUERY_ENGINE_GET_DMMF) {
      // cause a Rust panic
      await NodeAPIQueryEngineLibrary.debugPanic('FORCE_PANIC_QUERY_ENGINE_GET_DMMF')
    }

    const datamodel = options.datamodel ?? fs.readFileSync(options.datamodelPath!, 'utf-8')
    const dmmf: DMMF.Document = JSON.parse(await NodeAPIQueryEngineLibrary.dmmf(datamodel)) as DMMF.Document
    return dmmf
  } catch (e: any) {
    const error = JSON.parse(e.message)
    const message = addMissingOpenSSLInfo(error.message)
    throw new Error(chalk.redBright.bold('Schema parsing\n') + message)
  }
}

async function getDmmfNodeAPIFP(options: GetDMMFOptions) {
  /**
   * Perform side effects to retrieve variables and metadata that may be useful in the main pipeline's
   * error handling.
   */
  const preliminaryEither = await pipe(
    TE.Do,
    TE.bind('queryEnginePath', () => {
      return TE.tryCatch(
        () => resolveBinary(BinaryType.libqueryEngine, options.prismaPath),
        (e) => ({
          type: 'query-engine-unresolved',
          reason: 'Unable to resolve path to query-engine binary',
          error: e as Error, // "Could not find libquery-engine binary. Searched in..."
        }),
      )
    }),
    TE.bind('_', () => {
      return TE.tryCatch(
        () => isNodeAPISupported(),
        (e) => ({
          type: 'node-api-not-support',
          reason: 'The query-engine library is not supported on this platform',
          error: e as Error,
        }),
      )
    }),
  )()
  if (E.isLeft(preliminaryEither)) {
    const { reason, error } = preliminaryEither.left

    // TODO: is there an existing way of embedding the error in GetDmmfError?
    throw new GetDmmfError(reason)
  }
  const { queryEnginePath } = preliminaryEither.right
  debug(`Using CLI Query Engine (Node-API Library) at: ${queryEnginePath}`)

  const pipeline = pipe(
    pipe(
      E.tryCatch(
        () => load<NodeAPILibraryTypes.Library>(queryEnginePath),
        (e) => ({
          type: 'connection-error' as const,
          reason: 'Unable to establish a connection to query-engine-node-api library',
          error: e as Error,
        }),
      ),
      TE.fromEither,
    ),
    TE.map((NodeAPIQueryEngineLibrary) => ({ NodeAPIQueryEngineLibrary })),
    TE.chainW(({ NodeAPIQueryEngineLibrary }) => {
      return pipe(
        TE.tryCatch(
          () => {
            if (process.env.FORCE_PANIC_QUERY_ENGINE_GET_DMMF) {
              // trigger a Rust panic
              return NodeAPIQueryEngineLibrary.debugPanic('FORCE_PANIC_QUERY_ENGINE_GET_DMMF')
            }

            return Promise.resolve(undefined)
          },
          (e) => ({
            type: 'node-api' as const,
            reason: 'Error while interacting with query-engine-node-api library',
            error: e as Error,
          }),
        ),
        TE.map(() => ({ NodeAPIQueryEngineLibrary })),
      )
    }),
    TE.chainW(({ NodeAPIQueryEngineLibrary }) => {
      return pipe(
        TE.tryCatch(
          () => {
            if (options.datamodel) {
              return Promise.resolve(options.datamodel)
            }

            return fs.promises.readFile(options.datamodelPath!, 'utf-8')
          },
          (e) => ({
            type: 'read-datamodel-path' as const,
            reason: 'Error while trying to read datamodel path',
            error: e as Error,
            datamodelPath: options.datamodelPath,
          }),
        ),
        TE.map((datamodel) => ({ NodeAPIQueryEngineLibrary, datamodel })),
      )
    }),
    TE.chainW(({ NodeAPIQueryEngineLibrary, datamodel }) => {
      return pipe(
        TE.tryCatch(
          () => {
            return NodeAPIQueryEngineLibrary.dmmf(datamodel)
          },
          (e) => ({
            type: 'node-api' as const,
            reason: 'Error while interacting with query-engine-node-api library',
            error: e as Error,
          }),
        ),
        TE.map((result) => ({ result })),
      )
    }),
    TE.chainW(({ result }) => {
      return pipe(
        E.tryCatch(
          () => JSON.parse(result) as DMMF.Document,
          (e) => ({
            type: 'parse-json' as const,
            reason: 'Unable to parse JSON',
            error: e,
          }),
        ),
        TE.fromEither,
      )
    }),
  )

  const dmmfEither = await pipeline()
  if (E.isRight(dmmfEither)) {
    const { right: dmmf } = dmmfEither
    return dmmf
  }

  const error = match(dmmfEither.left)
    .with({ type: 'node-api' }, (e) => {
      try {
        const error = JSON.parse(e.error.message)
        const message = addMissingOpenSSLInfo(error.message)
        return new GetDmmfError(chalk.redBright.bold('Schema parsing\n') + message)
      } catch (jsonError) {
        return new GetDmmfError(e.reason)
      }
    })
    .with({ type: 'connection-error' }, (e) => {
      debug('e@getConfigNodeAPI "connection-error"', e)
      return new GetDmmfError(e.reason)
    })
    .with({ type: 'read-datamodel-path' }, (e) => {
      debug('error in getDmmfNodeAPI', e)
      return new GetDmmfError(e.reason)
    })
    .with({ type: 'parse-json' }, (e) => {
      debug('error in getDmmfNodeAPI', e)
      return new GetDmmfError(e.reason)
    })
    .exhaustive()

  throw error
}

async function getDmmfBinaryFP(options: GetDMMFOptions): Promise<DMMF.Document> {
  /**
   * Perform side effects to retrieve variables and metadata that may be useful in the main pipeline's
   * error handling.
   */
  const preliminaryEither = await pipe(
    TE.tryCatch(
      () => resolveBinary(BinaryType.queryEngine, options.prismaPath),
      (e) => ({
        type: 'query-engine-unresolved' as const,
        reason: 'Unable to resolve path to query-engine binary',
        error: e as Error,
      }),
    ),
    TE.map((queryEnginePath) => ({ queryEnginePath })),
    TE.chainW(({ queryEnginePath }) => {
      if (!options.datamodelPath) {
        return pipe(
          TE.tryCatch(
            () => tmpWrite(options.datamodel!),
            (e) => ({
              type: 'datamodel-write' as const,
              reason: 'Unable to write temp data model path',
              error: e as Error,
            }),
          ),
          TE.map((tempDatamodelPath) => ({ queryEnginePath, tempDatamodelPath })),
        )
      }

      return TE.right({
        queryEnginePath,
        tempDatamodelPath: undefined as string | undefined,
      })
    }),
  )()
  if (E.isLeft(preliminaryEither)) {
    const { reason, error } = preliminaryEither.left

    // TODO: is there an existing way of embedding the error in GetDmmfError?
    throw new GetDmmfError(reason)
  }
  const { queryEnginePath, tempDatamodelPath } = preliminaryEither.right
  debug(`Using CLI Query Engine (Binary) at: ${queryEnginePath}`)

  const pipeline = pipe(
    (() => {
      const execaOptions = {
        cwd: options.cwd,
        env: {
          PRISMA_DML_PATH: tempDatamodelPath,
          RUST_BACKTRACE: '1',
          ...(process.env.NO_COLOR ? {} : { CLICOLOR_FORCE: '1' }),
        },
        maxBuffer: MAX_BUFFER,
      }

      const args = ['--enable-raw-queries', 'cli', 'dmmf']

      if (process.env.FORCE_PANIC_QUERY_ENGINE_GET_DMMF) {
        return TE.tryCatch(
          () =>
            execa(
              queryEnginePath,
              ['cli', 'debug-panic', '--message', 'FORCE_PANIC_QUERY_ENGINE_GET_DMMF'],
              execaOptions,
            ),
          (e) => ({
            type: 'execa' as const,
            reason: 'Error while interacting with query-engine binary',
            error: e,
          }),
        )
      }

      return TE.tryCatch(
        () => execa(queryEnginePath, args, execaOptions),
        (e) => ({
          type: 'execa' as const,
          reason: 'Error while interacting with query-engine binary',
          error: e,
        }),
      )
    })(),
    TE.map((result) => {
      const shouldRetry = result.stdout.includes('Please wait until the') && options.retry && options.retry > 0
      return { result, shouldRetry }
    }),
    TE.chainW(({ result, shouldRetry }) => {
      if (shouldRetry) {
        return TE.left({
          type: 'retry' as const,
          reason: 'Retrying after "Please wait until"',
          retry: (options.retry ?? 0) - 1,
        })
      }

      return TE.right({ result })
    }),
    TE.chainW(({ result }) => {
      // necessary, as sometimes the query engine prints some other stuff
      // TODO: identify when the binary does that.
      const firstCurly = result.stdout.indexOf('{')
      const stdout = result.stdout.slice(firstCurly)

      return pipe(
        E.tryCatch(
          () => JSON.parse(stdout) as DMMF.Document,
          (e) => ({
            type: 'parse-json' as const,
            reason: 'Unable to parse JSON',
            error: e,
            result,
          }),
        ),
        TE.fromEither,
      )
    }),
  )

  const dmmfEither = await pipeline()
  if (E.isRight(dmmfEither)) {
    const { right: dmmf } = dmmfEither

    // TODO: we may want to show a warning in case we're not able to delete a temporary path
    const unlinkEither = await TE.tryCatch(
      () => {
        if (tempDatamodelPath) {
          return unlink(tempDatamodelPath)
        }

        return Promise.resolve(undefined)
      },
      (e) => ({
        type: 'unlink-temp-datamodel-path',
        reason: 'Unable to delete temporary datamodel path',
        error: e,
      }),
    )()

    return dmmf
  }

  const error = match(dmmfEither.left)
    .with({ type: 'execa' }, ({ error, reason }) => {
      const e = error as ExecaError

      /**
       * Capture and propagate possible Rust panics.
       */
      if (isExecaErrorCausedByRustPanic(e as execa.ExecaError)) {
        return new RustPanic(
          /* message */ e.shortMessage, // Command failed with exit code 101: ~/query-engine1.x cli debug-panic --message FORCE_PANIC_QUERY_ENGINE_GET_DMMF
          /* rustStack */ e.stderr, // thread 'main' panicked at 'FORCE_PANIC_QUERY_ENGINE_GET_DMMF', /root/build/query-engine/query-engine/src/cli.rs:95:21
          /* request */ 'query-engine get-dmmf',
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
          () => new GetDmmfError(errorOutput),
        ),
        E.map((jsonError) => {
          let message = `${chalk.redBright(jsonError.message)}\n`
          message = addMissingOpenSSLInfo(message)

          return new GetDmmfError(chalk.redBright.bold('Schema parsing\n') + message)
        }),
        E.getOrElse(identity),
      )

      return actualError
    })
    .with({ type: 'parse-json' }, ({ error, reason, result }) => {
      const message = `Problem while parsing the query engine response at ${queryEnginePath}. ${result.stdout}\n${
        (error as any)?.stack
      }`
      return new GetDmmfError(chalk.redBright.bold('JSON parsing\n') + message)
    })
    .with({ type: 'retry' }, ({ reason, retry }) => {
      // TODO: handle retry
    })
    .exhaustive()

  throw error
}

async function getDmmfBinary(options: GetDMMFOptions): Promise<DMMF.Document> {
  let result: ExecaChildProcess<string> | undefined | ExecaReturnValue<string>
  const queryEnginePath = await resolveBinary(BinaryType.queryEngine, options.prismaPath)
  debug(`Using CLI Query Engine (Binary) at: ${queryEnginePath}`)

  try {
    let tempDatamodelPath: string | undefined = options.datamodelPath
    if (!tempDatamodelPath) {
      try {
        tempDatamodelPath = await tmpWrite(options.datamodel!)
      } catch (err) {
        throw new Error(chalk.redBright.bold('Get DMMF ') + 'unable to write temp data model path')
      }
    }
    const execaOptions = {
      cwd: options.cwd,
      env: {
        PRISMA_DML_PATH: tempDatamodelPath,
        RUST_BACKTRACE: '1',
        ...(process.env.NO_COLOR ? {} : { CLICOLOR_FORCE: '1' }),
      },
      maxBuffer: MAX_BUFFER,
    }

    const args = ['--enable-raw-queries', 'cli', 'dmmf']

    if (process.env.FORCE_PANIC_QUERY_ENGINE_GET_DMMF) {
      await execa(
        queryEnginePath,
        ['cli', 'debug-panic', '--message', 'FORCE_PANIC_QUERY_ENGINE_GET_DMMF'],
        execaOptions,
      )
    }

    result = await execa(queryEnginePath, args, execaOptions)

    if (!options.datamodelPath) {
      await unlink(tempDatamodelPath)
    }

    if (result.stdout.includes('Please wait until the') && options.retry && options.retry > 0) {
      debug('Retrying after "Please wait until"')
      await new Promise((r) => setTimeout(r, 5000))
      return getDMMF({
        ...options,
        retry: options.retry - 1,
      })
    }

    // necessary, as sometimes the query engine prints some other stuff
    // TODO: identify when the binary does that.
    const firstCurly = result.stdout.indexOf('{')
    const stdout = result.stdout.slice(firstCurly)

    return JSON.parse(stdout)
  } catch (e: any) {
    /*
    Object.keys(e) [
      'shortMessage',
      'command',
      'escapedCommand',
      'exitCode',
      'signal',
      'signalDescription',
      'stdout',
      'stderr',
      'failed',
      'timedOut',
      'isCanceled',
      'killed'
    ]
    */
    console.log('e@getDmmfBinary', e)
    console.log('typeof e', typeof e)
    console.log('e.exitCode', e.exitCode)
    console.log('e.command', e.command)
    console.log('e.stack', e.stack)
    console.log('e.stdout', e.stdout)
    console.log('e.stderr', e.stderr)
    console.log('e.failed', e.failed)
    console.log('e.shortMessage', e.shortMessage)
    console.log('\n\n')

    debug('getDMMF failed', e)
    // If this unlikely event happens, try it at least once more
    if (e.message.includes('Command failed with exit code 26 (ETXTBSY)') && options.retry && options.retry > 0) {
      await new Promise((resolve) => setTimeout(resolve, 500))
      debug('Retrying after ETXTBSY')
      return getDMMF({
        ...options,
        retry: options.retry - 1,
      })
    }

    const output = e.stderr || e.stdout
    if (output) {
      let json
      try {
        json = JSON.parse(output)
      } catch (e) {
        //
      }
      let message = (json && json.message) || output
      message = addMissingOpenSSLInfo(message)
      throw new Error(chalk.redBright.bold('Schema parsing\n') + message)
    }
    if (e.message.includes('in JSON at position')) {
      throw new Error(
        `Problem while parsing the query engine response at ${queryEnginePath}. ${result?.stdout}\n${e.stack}`,
      )
    }
    throw new Error(e)
  }
}

function addMissingOpenSSLInfo(message: string) {
  if (
    message.includes(
      'debian-openssl-1.1.x: error while loading shared libraries: libssl.so.1.1: cannot open shared object file: No such file or directory',
    ) ||
    message.includes(
      'debian-openssl-1.0.x: error while loading shared libraries: libssl.so.1.0.0: cannot open shared object file: No such file or directory',
    )
  ) {
    message += `\n${chalk.green(
      `Your linux installation misses the openssl package. You can install it like so:\n`,
    )}${chalk.green.bold('apt-get -qy update && apt-get -qy install openssl')}`
  }
  return message
}

// See also removedFlags at
// https://github.com/prisma/prisma/blob/main/packages/engine-core/src/binary/BinaryEngine.ts#L174
function warnOnDeprecatedFeatureFlag(previewFeatures?: string[]) {
  const getMessage = (flag: string) =>
    `${chalk.blueBright(
      'info',
    )} The preview flag "${flag}" is not needed anymore, please remove it from your schema.prisma`

  const removedFeatureFlagMap = {
    insensitiveFilters: getMessage('insensitiveFilters'),
    atomicNumberOperations: getMessage('atomicNumberOperations'),
    connectOrCreate: getMessage('connectOrCreate'),
    transaction: getMessage('transaction'),
    nApi: getMessage('nApi'),
    transactionApi: getMessage('transactionApi'),
    uncheckedScalarInputs: getMessage('uncheckedScalarInputs'),
    nativeTypes: getMessage('nativeTypes'),
    createMany: getMessage('createMany'),
    groupBy: getMessage('groupBy'),
    referentialActions: getMessage('referentialActions'),
    microsoftSqlServer: getMessage('microsoftSqlServer'),
    selectRelationCount: getMessage('selectRelationCount'),
    orderByRelation: getMessage('orderByRelation'),
    orderByAggregateGroup: getMessage('orderByAggregateGroup'),
  }

  previewFeatures?.forEach((f) => {
    const removedMessage = removedFeatureFlagMap[f]
    if (removedMessage && !process.env.PRISMA_HIDE_PREVIEW_FLAG_WARNINGS) {
      console.warn(removedMessage)
    }
  })
}
