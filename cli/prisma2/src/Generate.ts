import {
  Command,
  format,
  HelpError,
  Dictionary,
  GeneratorDefinitionWithPackage,
  getSchema,
  getSchemaPath,
} from '@prisma/cli'
import chalk from 'chalk'
import { missingGeneratorMessage } from '@prisma/lift'
import { getGenerators } from '@prisma/sdk'
import { formatms } from './utils/formatms'
const pkg = eval(`require('../package.json')`)

/**
 * $ prisma migrate new
 */
export class Generate implements Command {
  public static new(aliases: Dictionary<string>): Generate {
    return new Generate(aliases)
  }

  // static help template
  private static help = format(`
    Generate the Photon Client.

    ${chalk.bold('Usage')}

      prisma2 generate 

  `)
  private constructor(private readonly aliases: Dictionary<string>) {}

  // parse arguments
  public async parse(argv: string[], minimalOutput = false): Promise<string | Error> {
    const datamodelPath = await getSchemaPath()
    const generators = await getGenerators({
      schemaPath: datamodelPath!,
      providerAliases: this.aliases,
      printDownloadProgress: true,
      version: pkg.prisma.version,
    })

    if (generators.length === 0) {
      console.log(missingGeneratorMessage)
    }

    // CONTINUE HERE

    for (const generator of generators) {
      const toStr = generator.options!.generator.output! ? chalk.dim(` to ${generator.options!.generator.output}`) : ''
      const name = generator.manifest ? generator.manifest.prettyName : generator.options!.generator.provider
      console.log(`Generating ${chalk.bold(name!)}${toStr}`)
      const before = Date.now()
      await generator.generate()
      generator.stop()
      const after = Date.now()
      console.log(`Done in ${formatms(after - before)}`)
    }

    return ''
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${Generate.help}`)
    }
    return Generate.help
  }
}
