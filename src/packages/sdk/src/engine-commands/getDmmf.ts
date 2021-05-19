import Debug from '@prisma/debug'
import { NApiEngineTypes } from '@prisma/engine-core'
import { EngineTypes } from '@prisma/fetch-engine'
import { DataSource, DMMF, GeneratorConfig } from '@prisma/generator-helper'
import chalk from 'chalk'
import execa from 'execa'
import fs from 'fs'
import tmpWrite from 'temp-write'
import { promisify } from 'util'
import { resolveBinary } from '../resolveBinary'

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

export async function getDMMF({
  datamodel,
  cwd = process.cwd(),
  prismaPath: queryEnginePath,
  datamodelPath,
  retry = 4,
  previewFeatures,
}: GetDMMFOptions): Promise<DMMF.Document> {
  warnOnDeprecatedFeatureFlag(previewFeatures)

  const useNapi =
    process.env.PRISMA_FORCE_NAPI === 'true' ||
    previewFeatures?.includes('nApi')
  if (useNapi) {
    queryEnginePath = await resolveBinary(
      EngineTypes.libqueryEngineNapi,
      queryEnginePath,
    )
    const NApiQueryEngine = require(queryEnginePath) as NApiEngineTypes.NAPI
    datamodel = datamodel ?? fs.readFileSync(datamodelPath!, 'utf-8')
    let dmmf: any
    try {
      dmmf = await NApiQueryEngine.dmmf({
        datamodel: datamodel,
        enableRawQueries: true,
      })
      console.log(dmmf)
    } catch (e) {
      throw new Error(e)
    }
    return dmmf
  } else {
    let result
    try {
      queryEnginePath = await resolveBinary(
        EngineTypes.queryEngine,
        queryEnginePath,
      )

      let tempDatamodelPath: string | undefined = datamodelPath
      if (!tempDatamodelPath) {
        try {
          tempDatamodelPath = await tmpWrite(datamodel!)
        } catch (err) {
          throw new Error(
            chalk.redBright.bold('Get DMMF ') +
              'unable to write temp data model path',
          )
        }
      }
      const options = {
        cwd,
        env: {
          PRISMA_DML_PATH: tempDatamodelPath,
          RUST_BACKTRACE: '1',
          ...(process.env.NO_COLOR ? {} : { CLICOLOR_FORCE: '1' }),
        },
        maxBuffer: MAX_BUFFER,
      }

      const args = ['--enable-raw-queries', 'cli', 'dmmf']
      result = await execa(queryEnginePath, args, options)

      if (!datamodelPath) {
        await unlink(tempDatamodelPath)
      }

      if (result.stdout.includes('Please wait until the') && retry > 0) {
        debug('Retrying after "Please wait until"')
        await new Promise((r) => setTimeout(r, 5000))
        return getDMMF({
          datamodel,
          cwd,
          prismaPath: queryEnginePath,
          datamodelPath,
          retry: retry - 1,
        })
      }

      // necessary, as sometimes the query engine prints some other stuff
      const firstCurly = result.stdout.indexOf('{')
      const stdout = result.stdout.slice(firstCurly)

      return JSON.parse(stdout)
    } catch (e) {
      debug('getDMMF failed', e)
      // If this unlikely event happens, try it at least once more
      if (
        e.message.includes('Command failed with exit code 26 (ETXTBSY)') &&
        retry > 0
      ) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        debug('Retrying after ETXTBSY')
        return getDMMF({
          datamodel,
          cwd,
          prismaPath: queryEnginePath,
          datamodelPath,
          retry: retry - 1,
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
          `Problem while parsing the query engine response at ${queryEnginePath}. ${result.stdout}\n${e.stack}`,
        )
      }
      throw new Error(e)
    }
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
