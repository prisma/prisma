import { Command, Env, format, HelpError } from '@prisma/cli'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'
import { performance } from 'perf_hooks'
import { promisify } from 'util'
import { generateClient } from './generation/generateClient'
import { getRandomString } from './utils/getRandomString'

const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)
const exists = promisify(fs.exists)

/**
 * $ prisma migrate new
 */
export class PhotonGenerate implements Command {
  public static new(env: Env): PhotonGenerate {
    return new PhotonGenerate(env)
  }

  // static help template
  private static help = format(`
    Generate the Photon Client.

    ${chalk.bold('Usage')}

      prisma generate 

  `)
  private constructor(private readonly env: Env) {}

  // parse arguments
  public async parse(argv: string[], minimalOutput = false): Promise<string | Error> {
    const datamodel = await this.getDatamodel()
    const output = path.join(this.env.cwd, '/node_modules/@generated/photon')
    const before = performance.now()
    if (!minimalOutput) {
      console.log(`\nGenerating Photon to ${output}`)
    }
    await generateClient(datamodel, this.env.cwd, output, true)

    const packageJson = {
      name: 'photon',
      description: 'Your personal photon client',
      version: `0.1.0-${getRandomString()}`,
    }

    await writeFile(path.join(output, 'package.json'), JSON.stringify(packageJson, null, 2))
    console.log(`✨ Done generating Photon in ${(performance.now() - before).toFixed(2)}ms`)
    if (!minimalOutput) {
      console.log(`\nYou can import it with ${chalk.greenBright(`import { Photon } from '@generated/photon'`)}`)
    }
    return ''
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${PhotonGenerate.help}`)
    }
    return PhotonGenerate.help
  }

  private async getDatamodel(): Promise<string> {
    const datamodelPath = path.join(this.env.cwd, 'datamodel.prisma')
    if (!(await exists(datamodelPath))) {
      throw new Error(`Could not find ${datamodelPath}`)
    }
    return readFile(datamodelPath, 'utf-8')
  }
}
