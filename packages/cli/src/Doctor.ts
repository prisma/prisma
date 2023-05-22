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
  keyBy,
  loadEnvFile,
  pick,
} from '@prisma/internals'
import { getSchemaPathAndPrint, MigrateEngine } from '@prisma/migrate'
import equal from 'fast-deep-equal'
import fs from 'fs'
import { bold, dim, green, red, underline } from 'kleur/colors'
import path from 'path'

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

${bold('Usage')}

  ${dim('$')} prisma doctor [options]

${bold('Options')}

  -h, --help   Display this help message
    --schema   Custom path to your Prisma schema

${bold('Examples')}

  With an existing schema.prisma
    ${dim('$')} prisma doctor

  Or specify a schema
    ${dim('$')} prisma doctor --schema=./schema.prisma

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

    const schema = await fs.promises.readFile(schemaPath, 'utf-8')
    const localDmmf = await getDMMF({ datamodel: schema })
    const config = await getConfig({ datamodel: schema, ignoreEnvVarErrors: false })

    console.error(`👩‍⚕️🏥 Prisma Doctor checking the database...`)

    const connectionString = getEffectiveUrl(config.datasources[0])
    // connectionString.value exists because `ignoreEnvVarErrors: false` would have thrown an error if not
    const canConnect = await canConnectToDatabase(connectionString.value!, path.dirname(schemaPath))
    if (typeof canConnect !== 'boolean') {
      throw new Error(`${canConnect.code}: ${canConnect.message}`)
    }

    const engine = new MigrateEngine({
      projectDir: path.dirname(schemaPath),
      schemaPath,
    })

    let datamodel
    try {
      const result = await engine.introspect({ schema })
      datamodel = result.datamodel
    } finally {
    }

    const remoteDmmf = await getDMMF({ datamodel })

    const remoteModels = keyBy(remoteDmmf.datamodel.models, (m) => m.dbName ?? m.name)

    const modelPairs = localDmmf.datamodel.models.map((localModel) => ({
      localModel,
      remoteModel: remoteModels[localModel.dbName ?? localModel.name],
    }))

    const getFieldName = (f: DMMF.Field) => f.dbName ?? f.name

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
      return new HelpError(`\n${bold(red(`!`))} ${error}\n${Doctor.help}`)
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
  let msg = `${bold(underline(model.name))}\n`
  if (missingModel) {
    msg += `↪ Model is missing in database\n`
  }

  for (const field of missingFields) {
    msg += `↪ Field ${bold(field.name)} is missing in database\n`
  }

  for (const { localField, remoteField } of incorrectFieldType) {
    const printFieldType = (f: DMMF.Field) => f.type + (f.isList ? '[]' : '')

    msg += `↪ Field ${localField.name} has type ${green(printFieldType(localField))} locally, but ${red(
      printFieldType(remoteField),
    )} remote\n`
  }

  return msg
}
