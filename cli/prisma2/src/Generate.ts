import { Command, Env, format, HelpError, Dictionary, GeneratorDefinitionWithPackage } from '@prisma/cli'
import chalk from 'chalk'
import { missingGeneratorMessage } from '@prisma/lift'
import { getCompiledGenerators } from '@prisma/photon'
import { formatms } from './utils/formatms'
import { getDatamodel } from './getDatamodel'

/**
 * $ prisma migrate new
 */
export class Generate implements Command {
  public static new(env: Env, generators: Dictionary<GeneratorDefinitionWithPackage>): Generate {
    return new Generate(env, generators)
  }

  // static help template
  private static help = format(`
    Generate the Photon Client.

    ${chalk.bold('Usage')}

      prisma2 generate 

  `)
  private constructor(
    private readonly env: Env,
    private readonly generators: Dictionary<GeneratorDefinitionWithPackage>,
  ) {}

  // parse arguments
  public async parse(argv: string[], minimalOutput = false): Promise<string | Error> {
    const datamodel = await getDatamodel(this.env.cwd)
    const generators = await getCompiledGenerators(this.env.cwd, datamodel, this.generators)
    if (generators.length === 0) {
      console.log(missingGeneratorMessage)
    }

    for (const generator of generators) {
      const toStr = generator.output ? chalk.dim(` to ${generator.output}`) : ''
      console.log(`Generating ${chalk.bold(generator.prettyName!)}${toStr}`)
      const before = Date.now()
      await generator.generate()
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
