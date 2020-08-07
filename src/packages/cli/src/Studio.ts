import { arg, Command, format, HelpError, isError } from '@prisma/sdk'
import chalk from 'chalk'
import Debug from '@prisma/debug'
import StudioServer from '@prisma/studio-server'
import fs from 'fs'
import getPort from 'get-port'
import path from 'path'
import open from 'open'

import { ProviderAliases, getSchemaPathSync } from '@prisma/sdk'
import { getPlatform } from '@prisma/get-platform'
import { ExperimentalFlagError } from './utils/experimental'

const packageJson = require('../package.json') // eslint-disable-line @typescript-eslint/no-var-requires

export class Studio implements Command {
  public static new(providerAliases: ProviderAliases): Studio {
    return new Studio(providerAliases)
  }

  private static help = format(`
    Browse your data with Studio

    ${chalk.bold.yellow('WARNING')} ${chalk.bold(
    "Prisma's studio functionality is currently in an experimental state.",
  )}
    ${chalk.dim(
      'When using any of the commands below you need to explicitly opt-in via the --experimental flag.',
    )}

    ${chalk.bold('Usage')}

      ${chalk.dim('$')} prisma studio --experimental

    ${chalk.bold('Options')}

      -h, --help        Displays this help message
      -p, --port        Port to start Studio on
      -b, --browser     Browser to open Studio in

    ${chalk.bold('Examples')}

      Start Studio on the default port
      ${chalk.dim('$')} prisma studio --experimental

      Start Studio on a custom port
      ${chalk.dim('$')} prisma studio --port 5555 --experimental

      Start Studio in a specific browser
      ${chalk.dim(
        '$',
      )} prisma studio --port 5555 --browser firefox --experimental
      ${chalk.dim('$')} BROWSER=firefox prisma studio --port 5555 --experimental

      Start Studio without opening in a browser
      ${chalk.dim('$')} prisma studio --port 5555 --browser none --experimental
      ${chalk.dim('$')} BROWSER=none prisma studio --port 5555 --experimental
  `)

  private constructor(private readonly providerAliases: ProviderAliases) {
    this.providerAliases = providerAliases
  }

  /**
   * Parses arguments passed to this command, and starts Studio
   *
   * @param argv Array of all arguments
   */
  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--port': Number,
      '-p': '--port',
      '--browser': String,
      '-b': '--browser',
      '--schema': String,
      '--experimental': Boolean,
    })

    if (isError(args)) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    if (!args['--experimental']) {
      throw new ExperimentalFlagError()
    }

    const schemaPath = getSchemaPathSync(args['--schema'])
    if (!schemaPath) {
      throw new Error(`Could not find ${args['--schema'] || 'schema.prisma'}`)
    }

    const port =
      args['--port'] || (await getPort({ port: getPort.makeRange(5555, 5600) }))
    const browser = args['--browser'] || process.env.BROWSER
    const platform = await getPlatform()
    const extension = platform === 'windows' ? '.exe' : ''
    const queryEnginePath =
      process.env.NODE_ENV === 'production'
        ? eval(
            `require('path').join(__dirname, '../query-engine-${platform}${extension}')`,
          )
        : eval(
            `require('path').join(__dirname, '../node_modules/@prisma/sdk/query-engine-${platform}${extension}')`,
          )
    const staticAssetDir =
      process.env.NODE_ENV === 'production'
        ? path.resolve(__dirname, './public')
        : path.resolve(__dirname, '../dist/public')

    const studio = new StudioServer({
      schemaPath,
      port,
      prismaClient: {
        generator: {
          version: packageJson.prisma.version,
          providerAliases: this.providerAliases,
        },
      },
      binaryPaths: {
        queryEngine: queryEnginePath,
      },
      staticAssetDir,
      versions: {
        prisma2: packageJson.version,
        queryEngine: packageJson.prisma.version,
      },
    })

    await studio.start()

    const serverUrl = `http://localhost:${port}`
    if (!browser || browser.toLowerCase() !== 'none') {
      await open(serverUrl, {
        app: browser,
        url: true,
        // eslint-disable-next-line @typescript-eslint/no-empty-function
      }).catch(() => {}) // Ignore any errors
    }

    return `Studio started at ${serverUrl}`
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${Studio.help}`)
    }

    return Studio.help
  }
}
