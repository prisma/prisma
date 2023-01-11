import type { DMMF } from '@prisma/generator-helper'
import {
  arg,
  canConnectToDatabase,
  checkUnsupportedDataProxy,
  Command,
  format,
  getConfig,
  getDMMF,
  getEffectiveUrl,
  HelpError,
  IntrospectionEngine,
  keyBy,
  loadEnvFile,
  pick,
} from '@prisma/internals'
import { getSchemaPathAndPrint } from '@prisma/migrate'
import chalk from 'chalk'
import equal from 'fast-deep-equal'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

const readFile = promisify(fs.readFile)
type IncorrectFieldTypes = Array<{
  localField: DMMF.Field
  remoteField: DMMF.Field
}>

export class Doctor implements Command {
  static new(): Doctor {
    return new Doctor()
  }

  private static help = format(`
Check, if the schema and the database are in sync.

${chalk.bold('Usage')}

  ${chalk.dim('$')} prisma doctor [options]

${chalk.bold('Options')}

  -h, --help   Display this help message
    --schema   Custom path to your Prisma schema

${chalk.bold('Examples')}

  With an existing schema.prisma
    ${chalk.dim('$')} prisma doctor

  Or specify a schema
    ${chalk.dim('$')} prisma doctor --schema=./schema.prisma

  `)

  async parse(argv: string[]): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--schema': String,
      '--telemetry-information': String,
    })

    if (args instanceof Error) {
      return this.help(args.message)
    }

    await checkUnsupportedDataProxy('doctor', args, true)

    if (args['--help']) {
      return this.help()
    }

    loadEnvFile(args['--schema'], true)

    const schemaPath = await getSchemaPathAndPrint(args['--schema'])

    const schema = await readFile(schemaPath, 'utf-8')
    const localDmmf = await getDMMF({ datamodel: schema })
    const config = await getConfig({ datamodel: schema, ignoreEnvVarErrors: false })

    console.error(`👩‍⚕️🏥 Prisma Doctor checking the database...`)

    const connectionString = getEffectiveUrl(config.datasources[0])
    // connectionString.value exists because `ignoreEnvVarErrors: false` would have thrown an error if not
    const canConnect = await canConnectToDatabase(connectionString.value!, path.dirname(schemaPath))
    if (typeof canConnect !== 'boolean') {
      throw new Error(`${canConnect.code}: ${canConnect.message}`)
    }

    const engine = new IntrospectionEngine({
      cwd: path.dirname(schemaPath),
    })

    let datamodel
    try {
      const result = await engine.introspect(schema)
      datamodel = result.datamodel
    } finally {
      engine.stop()
    }

    const remoteDmmf = await getDMMF({ datamodel })

    const remoteModels = keyBy(remoteDmmf.datamodel.models, (m) => m.dbName ?? m.name)

    const modelPairs = localDmmf.datamodel.models.map((localModel) => ({
      localModel,
      remoteModel: remoteModels[localModel.dbName ?? localModel.name],
    }))

    const getFieldName = (f: DMMF.Field) => (f.dbNames && f.dbNames.length > 0 ? f.dbNames[0] : f.name)

    const messages: string[] = []

    for (const { localModel, remoteModel } of modelPairs) {
      let missingModel = false
      const missingFields: DMMF.Field[] = []
      const incorrectFieldType: IncorrectFieldTypes = []

      if (!remoteModel) {
        missingModel = true
      } else {
        const remoteFields = keyBy(remoteModel.fields, getFieldName)

        for (const localField of localModel.fields) {
          const remoteField = remoteFields[getFieldName(localField)]
          if (!remoteField) {
            missingFields.push(localField)
          } else if (!equal(pick(localField, ['type', 'isList']), pick(remoteField, ['type', 'isList']))) {
            incorrectFieldType.push({ localField, remoteField })
          }
        }
      }

      const msg = printModelMessage({
        model: localModel,
        missingModel,
        missingFields,
        incorrectFieldType,
      })
      if (msg) {
        messages.push(msg)
      }
    }

    if (messages.length > 0) {
      throw new Error('\n\n' + messages.join('\n\n'))
    }

    return `Everything in sync 🔄`
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${Doctor.help}`)
    }
    return Doctor.help
  }
}

function printModelMessage({
  model,
  missingModel,
  missingFields,
  incorrectFieldType,
}: {
  model: DMMF.Model
  missingModel: boolean
  missingFields: DMMF.Field[]
  incorrectFieldType: IncorrectFieldTypes
}) {
  if (!missingModel && missingFields.length === 0 && incorrectFieldType.length === 0) {
    return null
  }
  let msg = `${chalk.bold.underline(model.name)}\n`
  if (missingModel) {
    msg += `↪ Model is missing in database\n`
  }

  for (const field of missingFields) {
    msg += `↪ Field ${chalk.bold(field.name)} is missing in database\n`
  }

  for (const { localField, remoteField } of incorrectFieldType) {
    const printFieldType = (f: DMMF.Field) => f.type + (f.isList ? '[]' : '')

    msg += `↪ Field ${localField.name} has type ${chalk.greenBright(
      printFieldType(localField),
    )} locally, but ${chalk.redBright(printFieldType(remoteField))} remote\n`
  }

  return msg
}
