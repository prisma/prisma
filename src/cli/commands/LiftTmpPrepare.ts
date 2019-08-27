import { arg, Command, Dictionary, Env, format, GeneratorDefinitionWithPackage, HelpError } from '@prisma/cli'
import chalk from 'chalk'
import { Lift } from '../../Lift'
import { occupyPath } from '../../utils/occupyPath'

/**
 * $ prisma migrate new
 */
export class LiftTmpPrepare implements Command {
  public static new(env: Env, generators: Dictionary<GeneratorDefinitionWithPackage>): LiftTmpPrepare {
    return new LiftTmpPrepare(env, generators)
  }

  // static help template
  private static help = format(`
    Watch local changes and migrate automatically

    ${chalk.bold('Usage')}

      prisma dev
  `)
  private constructor(
    private readonly env: Env,
    private readonly generators: Dictionary<GeneratorDefinitionWithPackage>,
  ) {}

  // parse arguments
  public async parse(argv: string[]): Promise<string | Error> {
    await occupyPath(this.env.cwd)

    const lift = new Lift(this.env.cwd)
    await lift.watchUp({
      generatorDefinitions: this.generators,
    })

    lift.stop()

    console.log('Done executing tmp prepare')
    process.exit(0)

    return ''
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${LiftTmpPrepare.help}`)
    }
    return LiftTmpPrepare.help
  }
}
