import {
  Command,
  Env,
  format,
  HelpError,
  CompiledGeneratorDefinition,
  Dictionary,
  GeneratorDefinitionWithPackage,
} from '@prisma/cli'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'
import { performance } from 'perf_hooks'
import { promisify } from 'util'
import { missingGeneratorMessage, getCompiledGenerators } from '@prisma/lift'
import { formatms } from './utils/formatms'
import { getDatamodel } from './getConfig'

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
      console.log(`Generating ${chalk.bold(generator.prettyName!)}`)
      const before = Date.now()
      // try {
      await generator.generate()
      const after = Date.now()
      console.log(`Done in ${formatms(after - before)}`)
      // } catch (e) {
      //   console.error(e)
      // }
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
