import Debug from '@prisma/debug'
import type { NodeAPILibraryTypes } from '@prisma/engine-core'
import { getCliQueryEngineBinaryType } from '@prisma/engines'
import { BinaryType } from '@prisma/fetch-engine'
import type { DataSource, DMMF, GeneratorConfig } from '@prisma/generator-helper'
import { isNodeAPISupported } from '@prisma/get-platform'
import chalk from 'chalk'
import type { ExecaChildProcess, ExecaReturnValue } from 'execa'
import execa from 'execa'
import fs from 'fs'
import tmpWrite from 'temp-write'
import { promisify } from 'util'

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
// TODO add error handling functions
export async function getDMMF(options: GetDMMFOptions): Promise<DMMF.Document> {
  warnOnDeprecatedFeatureFlag(options.previewFeatures)
  const cliEngineBinaryType = getCliQueryEngineBinaryType()
  let dmmf: DMMF.Document | undefined
  if (cliEngineBinaryType === BinaryType.libqueryEngine) {
    dmmf = await getDmmfNodeAPI(options)
  } else {
    dmmf = await getDmmfBinary(options)
  }
  return dmmf
}

async function getDmmfNodeAPI(options: GetDMMFOptions): Promise<DMMF.Document> {
  const queryEnginePath = await resolveBinary(BinaryType.libqueryEngine, options.prismaPath)
  await isNodeAPISupported()

  debug(`Using CLI Query Engine (Node-API) at: ${queryEnginePath}`)
  const NodeAPIQueryEngineLibrary = load<NodeAPILibraryTypes.Library>(queryEnginePath)
  const datamodel = options.datamodel ?? fs.readFileSync(options.datamodelPath!, 'utf-8')
  let dmmf: DMMF.Document | undefined
  try {
    dmmf = JSON.parse(await NodeAPIQueryEngineLibrary.dmmf(datamodel)) as DMMF.Document
  } catch (e: any) {
    const error = JSON.parse(e.message)
    const message = addMissingOpenSSLInfo(error.message)
    throw new Error(chalk.redBright.bold('Schema parsing\n') + message)
  }
  return dmmf
}

async function getDmmfBinary(options: GetDMMFOptions): Promise<DMMF.Document> {
  let result: ExecaChildProcess<string> | undefined | ExecaReturnValue<string>
  const queryEnginePath = await resolveBinary(BinaryType.queryEngine, options.prismaPath)
  debug(`Using CLI Query Engine (Binary) at: ${queryEnginePath}`)

  try {
    const execaOptions = {
      cwd: options.cwd,
      env: {
        PRISMA_DML: undefined,
        RUST_BACKTRACE: '1',
        ...(process.env.NO_COLOR ? {} : { CLICOLOR_FORCE: '1' }),
      },
      maxBuffer: MAX_BUFFER,
    }

    if (options.datamodel) {
      // @ts-ignore
      execaOptions.env.PRISMA_DML = Buffer.from(options.datamodel).toString('base64')
    } else if (options.datamodelPath) {
      const schema = fs.readFileSync(options.datamodelPath, 'utf-8')
      // @ts-ignore
      execaOptions.env.PRISMA_DML = Buffer.from(schema).toString('base64')
    }
    debug(`getDmmfBinary PRISMA_DML: ${execaOptions.env.PRISMA_DML}`)

    const args = ['--enable-raw-queries', 'cli', 'dmmf']
    result = await execa(queryEnginePath, args, execaOptions)

    if (result.stdout.includes('Please wait until the') && options.retry && options.retry > 0) {
      debug('Retrying after "Please wait until"')
      await new Promise((r) => setTimeout(r, 5000))
      return getDMMF({
        ...options,
        retry: options.retry - 1,
      })
    }

    // necessary, as sometimes the query engine prints some other stuff
    const firstCurly = result.stdout.indexOf('{')
    const stdout = result.stdout.slice(firstCurly)

    return JSON.parse(stdout)
  } catch (e: any) {
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
