import { arg, Command, Dictionary, format, GeneratorDefinitionWithPackage, HelpError } from '@prisma/cli'
import chalk from 'chalk'
import { Lift } from '../../Lift'
import { ensureDatabaseExists } from '../../utils/ensureDatabaseExists'
import { occupyPath } from '../../utils/occupyPath'

/**
 * $ prisma migrate new
 */
export class LiftWatch implements Command {
  public static new(generators: Dictionary<GeneratorDefinitionWithPackage>): LiftWatch {
    return new LiftWatch(generators)
  }

  // static help template
  private static help = format(`
    Watch local changes and migrate automatically

    ${chalk.bold('Usage')}

      prisma dev

    ${chalk.bold('Options')}

      -c, --create-db   Create the database in case it doesn't exist
  `)
  private constructor(private readonly generators: Dictionary<GeneratorDefinitionWithPackage>) {}

  // parse arguments
  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(argv, {
      '--preview': Boolean,
      '-p': '--preview',
      '--create-db': Boolean,
      '-c': '--create-db',
    })
    const preview = args['--preview'] || false

    await occupyPath(process.cwd())

    await ensureDatabaseExists('dev', args['--create-db'])

    const lift = new Lift()
    return lift.watch({
      preview,
      generatorDefinitions: this.generators,
    })
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${LiftWatch.help}`)
    }
    return LiftWatch.help
  }
}
