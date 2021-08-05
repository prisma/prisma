import Debug from '@prisma/debug'
import { NodeAPILibraryTypes } from '@prisma/engine-core'
import { getCliQueryEngineBinaryType } from '@prisma/engines'
import { BinaryType } from '@prisma/fetch-engine'
import { DataSource, DMMF, GeneratorConfig } from '@prisma/generator-helper'
import { isNodeAPISupported } from '@prisma/get-platform'
import chalk from 'chalk'
import execa, { ExecaChildProcess, ExecaReturnValue } from 'execa'
import fs from 'fs'
import tmpWrite from 'temp-write'
import { resolveBinary } from '../resolveBinary'
import { load } from '../utils/load'

const debug = Debug('prisma:getDMMF')

const MAX_BUFFER = 1_000_000_000

export interface ConfigMetaFormat {
  datasources: DataSource[]
  generators: GeneratorConfig[]
  warnings: string[]
}

// TODO Why are none of these required
export type GetDMMFOptions = {
  schema?: string
  schemaPath?: string
  cwd?: string
  enginePath?: string
  previewFeatures?: string[]
}

export async function getDMMF(options: GetDMMFOptions): Promise<DMMF.Document> {
  warnOnDeprecatedFeatureFlag(options.previewFeatures) // TODO Why are we doing this for getDmmf but in getConfig the engines return the errors??
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
  const queryEnginePath = await resolveBinary(
    BinaryType.libqueryEngine,
    options.enginePath,
  )
  await isNodeAPISupported()

  debug(`Using Node-API Query Engine at: ${queryEnginePath}`)
  const NodeAPIQueryEngineLibrary =
    load<NodeAPILibraryTypes.Library>(queryEnginePath)
  const datamodel =
    options.schema ?? fs.readFileSync(options.schemaPath!, 'utf-8')
  let dmmf: DMMF.Document | undefined
  try {
    dmmf = JSON.parse(
      await NodeAPIQueryEngineLibrary.dmmf(datamodel),
    ) as DMMF.Document
  } catch (e) {
    const error = JSON.parse(e.message)
    const message = addMissingOpenSSLInfo(error.message)
    throw new Error(chalk.redBright.bold('Schema parsing\n') + message)
  }
  return dmmf
}

async function getDmmfBinary(options: GetDMMFOptions): Promise<DMMF.Document> {
  let result: ExecaChildProcess<string> | undefined | ExecaReturnValue<string>
  const queryEnginePath = await resolveBinary(
    BinaryType.queryEngine,
    options.enginePath,
  )
  debug(`Using Query Engine Binary at: ${queryEnginePath}`)

  try {
    let tmpSchemaPath: string | undefined = options.schemaPath
    if (!tmpSchemaPath) {
      try {
        tmpSchemaPath = await tmpWrite(options.schema!)
      } catch (err) {
        throw new Error(
          chalk.redBright.bold('Get DMMF ') +
            'unable to write temp data model path',
        )
      }
    }
    const execaOptions = {
      cwd: options.cwd,
      env: {
        PRISMA_DML_PATH: tmpSchemaPath,
        RUST_BACKTRACE: '1',
        ...(process.env.NO_COLOR ? {} : { CLICOLOR_FORCE: '1' }),
      },
      maxBuffer: MAX_BUFFER,
    }

    const args = ['--enable-raw-queries', 'cli', 'dmmf']
    result = await execa(queryEnginePath, args, execaOptions)

    if (!options.schemaPath) {
      await fs.promises.unlink(tmpSchemaPath)
    }

    // necessary, as sometimes the query engine prints some other stuff
    const firstCurly = result.stdout.indexOf('{')
    const stdout = result.stdout.slice(firstCurly)

    return JSON.parse(stdout)
  } catch (e) {
    debug('getDMMF failed', e)
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
    transactionApi: getMessage('transactionApi'),
    uncheckedScalarInputs: getMessage('uncheckedScalarInputs'),
    nativeTypes: getMessage('nativeTypes'),
    createMany: getMessage('createMany'),
    groupBy: getMessage('groupBy'),
  }

  previewFeatures?.forEach((f) => {
    const removedMessage = removedFeatureFlagMap[f]
    if (removedMessage && !process.env.PRISMA_HIDE_PREVIEW_FLAG_WARNINGS) {
      console.warn(removedMessage)
    }
  })
}
