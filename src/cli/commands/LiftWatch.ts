import { Command, arg, format, Env, HelpError, GeneratorDefinitionWithPackage, Dictionary } from '@prisma/cli'
import chalk from 'chalk'
import { Lift } from '../../Lift'
import { occupyPath } from '../../utils/occupyPath'

/**
 * $ prisma migrate new
 */
export class LiftWatch implements Command {
  static new(env: Env, generators: Dictionary<GeneratorDefinitionWithPackage>): LiftWatch {
    return new LiftWatch(env, generators)
  }
  private constructor(
    private readonly env: Env,
    private readonly generators: Dictionary<GeneratorDefinitionWithPackage>,
  ) {}

  // parse arguments
  async parse(argv: string[]): Promise<string | Error> {
    const args = arg(argv, {
      '--preview': Boolean,
      '-p': '--preview',
    })
    const preview = args['--preview'] || false

    await occupyPath(this.env.cwd)

    const lift = new Lift(this.env.cwd)
    return lift.watch({
      preview,
      generatorDefinitions: this.generators,
    })
  }

  // help message
  help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${LiftWatch.help}`)
    }
    return LiftWatch.help
  }

  // static help template
  private static help = format(`
    Watch local changes and migrate automatically

    ${chalk.bold('Usage')}

      prisma dev
  `)
}
