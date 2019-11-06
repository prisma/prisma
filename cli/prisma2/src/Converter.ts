import { arg, Command, format, HelpError, isError } from '@prisma/cli'
import chalk from 'chalk'
import { DatabaseType, DefaultParser } from 'prisma-datamodel'
import { isdlToDatamodel2 } from '@prisma/sdk'
import {  readDefinition } from 'prisma-yml/dist/yaml'
import fs from 'fs'
import path from 'path'
export class Converter implements Command {
  public static new(): Converter {
    return new Converter()
  }

  // static help template
  private static help = format(`
    Convert a datamodel 1.1 to datamodel 2

    ${chalk.bold('Usage')}

      prisma2 convert

    ${chalk.bold('Options')}

      -h, --help       Displays this help message

    ${chalk.bold('Examples')}

      ${chalk.dim(`$`)} prisma2 convert ./prisma.yml > new-datamodel.prisma
  `)
  private constructor() {}

  // parse arguments
  public async parse(argv: string[]): Promise<string | Error> {
    // parse the arguments according to the spec
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
    })
    if (isError(args)) {
      return this.help(args.message)
    } else if (args._.length === 0 || args['--help']) {
      return this.help()
    }
    const prisma_path = args._[0]
    const prisma_yml = await readDefinition(path.join(prisma_path, 'prisma.yml'), {})
    const models = prisma_yml.definition.datamodel;
    let datamodel = ''
    if(typeof models === "string"){
      datamodel = fs.readFileSync(path.join(prisma_path, models), {encoding: 'utf8'})
    } else if(typeof models === 'object' && models.length > 0){
      const files = models.map(model_path => fs.readFileSync(path.join(prisma_path, model_path), {encoding: 'utf8'}))
      datamodel = files.join('\n')
    } else {
      return this.help()
    }
    const parser = DefaultParser.create(DatabaseType.postgres)
    const isdl = parser.parseFromSchemaString(datamodel)
    return isdlToDatamodel2(isdl, [])
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${Converter.help}`)
    }
    return Converter.help
  }
}
