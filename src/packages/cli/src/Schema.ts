import {
  arg,
  Command,
  format,
  getConfig,
  getDMMF,
  getSchemaPath,
  HelpError,
} from '@prisma/sdk'
import chalk from 'chalk'
import fs from 'fs'
import globby from 'globby'
import path from 'path'

/**
 * $ prisma schema
 */
export class Schema implements Command {
  public static new(): Schema {
    return new Schema()
  }

  private static help = format(`
    Generate a Prisma schema from multiple .prisma files.
    
    ${chalk.bold('Usage')}
    
      ${chalk.dim('$')} prisma schema [options]
    
    ${chalk.bold('Options')}
    
      -h, --help   Display this help message
        --schema   Custom path to your Prisma schema
        --input    Path to your Prisma files
    
    ${chalk.bold('Examples')}
    
      Building a schema from .prisma files in an src folder
        ${chalk.dim(
          '$',
        )} prisma schema --schema=./prisma/schema.prisma --input=./src
    
    `)

  private generateSchema(schemaPath: string, inputPath: string): string {
    const schemas = globby.sync(`${inputPath}/**/*.prisma`)

    const existingSchema = fs
      .readFileSync(schemaPath, 'utf-8')
      .toString()
      .split(/(model|enum)/g)[0]
      .trimEnd()

    const schema = schemas.reduce((currentSchema, filename) => {
      const schemaFragment = fs.readFileSync(filename, 'utf-8').toString()

      return `${currentSchema} \n\n${schemaFragment}`
    }, existingSchema)

    return schema
  }

  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--schema': String,
      '--input': String,
      '--telemetry-information': String,
    })

    if (args instanceof Error) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    const schemaPath = await getSchemaPath(args['--schema'])

    if (!schemaPath) {
      throw new Error(
        `Could not find a ${chalk.bold(
          'schema.prisma',
        )} file that is required for this command.\nYou can either provide it with ${chalk.greenBright(
          '--schema',
        )}, set it as \`prisma.schema\` in your package.json or put it into the default location ${chalk.greenBright(
          './prisma/schema.prisma',
        )} https://pris.ly/d/prisma-schema-location`,
      )
    }

    const inputPath = args['--input']

    if (!inputPath) {
      throw new Error(
        `Could not find a ${chalk.bold(
          'input',
        )} path that is required for this command.\nYou can provide it with ${chalk.greenBright(
          '--input',
        )}`,
      )
    }

    console.log(
      chalk.dim(
        `Prisma schema loaded from ${path.relative(process.cwd(), schemaPath)}`,
      ),
    )

    const schema = this.generateSchema(schemaPath, inputPath)

    await getDMMF({
      datamodel: schema,
    })

    await getConfig({
      datamodel: schema,
    })

    fs.writeFileSync(schemaPath, schema)

    return `The schema at ${chalk.underline(schemaPath)} has been generated 🚀`
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${Schema.help}`)
    }
    return Schema.help
  }
}
