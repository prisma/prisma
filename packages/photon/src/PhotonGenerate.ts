import { arg, Command, Env, format, HelpError } from '@prisma/cli'
import chalk from 'chalk'
import fs from 'fs'
import { safeLoad } from 'js-yaml'
import path from 'path'
import { performance } from 'perf_hooks'
import { promisify } from 'util'
import { generateClient } from './generation/generateClient'

const readFile = promisify(fs.readFile)
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
  public async parse(argv: string[]): Promise<string | Error> {
    const ymlPath = await this.getPrismaYmlPath()
    const config = await readFile(ymlPath, 'utf-8')
    const datamodelPath = await this.getDatamodelPath(config, ymlPath)
    const datamodel = await readFile(datamodelPath, 'utf-8')
    const output = path.join(this.env.cwd, '/node_modules/@generated/photon')
    const before = performance.now()
    console.log(`\nGenerating Photon to ${output}`)
    await generateClient(datamodel, ymlPath, output, true)
    console.log(`✨ Done generating Photon in ${(performance.now() - before).toFixed(2)}ms`)
    console.log(`\nYou can import it with ${chalk.greenBright(`import { Photon } from '@generated/photon'`)}`)
    return ''
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${PhotonGenerate.help}`)
    }
    return PhotonGenerate.help
  }

  private async getPrismaYmlPath() {
    if (await exists('prisma.yml')) {
      return 'prisma.yml'
    }

    const prismaPath = path.join(process.cwd(), 'prisma/prisma.yml')
    if (await exists(prismaPath)) {
      return prismaPath
    }

    const parentPath = path.join(process.cwd(), '../prisma.yml')
    if (await exists(parentPath)) {
      return parentPath
    }

    throw new Error(`Could not find prisma.yml`)
  }

  private async getDatamodelPath(config: string, configPath: string) {
    const yml = safeLoad(config)
    if (yml.datamodel) {
      const datamodelPath = path.resolve(yml.datamodel)
      if (await exists(datamodelPath)) {
        return datamodelPath
      } else {
        throw new Error(`datamodel: ${yml.datamodel} provided in ${configPath} does not exist in ${datamodelPath}`)
      }
    }
    const potentialPath = path.join(path.dirname(configPath), 'datamodel.prisma')
    if (await exists(potentialPath)) {
      return potentialPath
    }
    throw new Error(`${configPath} doesn't have a datamodel property`)
  }
}
