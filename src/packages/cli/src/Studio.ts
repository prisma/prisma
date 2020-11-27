import { enginesVersion } from '@prisma/engines'
import { getPlatform } from '@prisma/get-platform'
import {
  arg,
  Command,
  format,
  getSchemaPath,
  HelpError,
  isError,
  ProviderAliases,
} from '@prisma/sdk'
import StudioServer from '@prisma/studio-server'
import chalk from 'chalk'
import getPort from 'get-port'
import open from 'open'
import path from 'path'

const packageJson = require('../package.json') // eslint-disable-line @typescript-eslint/no-var-requires

export class Studio implements Command {
  public instance?: StudioServer

  public static new(providerAliases: ProviderAliases): Studio {
    return new Studio(providerAliases)
  }

  private static help = format(`
    Browse your data with Prisma Studio

    ${chalk.bold('Usage')}

      ${chalk.dim('$')} prisma studio

    ${chalk.bold('Options')}

      -h, --help        Display this help message
      -p, --port        Port to start Studio on
      -b, --browser     Browser to open Studio in

    ${chalk.bold('Examples')}

      Start Studio on the default port
      ${chalk.dim('$')} prisma studio

      Start Studio on a custom port
      ${chalk.dim('$')} prisma studio --port 5555

      Start Studio in a specific browser
      ${chalk.dim('$')} prisma studio --port 5555 --browser firefox
      ${chalk.dim('$')} BROWSER=firefox prisma studio --port 5555

      Start Studio without opening in a browser
      ${chalk.dim('$')} prisma studio --port 5555 --browser none
      ${chalk.dim('$')} BROWSER=none prisma studio --port 5555
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
      '--telemetry-information': String,
    })

    if (isError(args)) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    if (args['--experimental']) {
      console.warn(
        `${chalk.yellow(
          'warn',
        )} --experimental is no longer required for this command as Studio is now Generally Available.`,
      )
    }

    const schemaPath = await getSchemaPath(args['--schema'])

    if (!schemaPath) {
      throw new Error(
        `Could not find a ${chalk.bold(
          'schema.prisma',
        )} file that is required for this command.\nYou can either provide it with ${chalk.greenBright(
          '--schema',
        )}, set it as \`prisma.schema\` in your package.json or put it into the default location ${chalk.greenBright(
          './prisma/schema.prisma',
        )} https://pris.ly/d/prisma-schema-location`,
      )
    }

    console.log(
      chalk.dim(
        `Prisma schema loaded from ${path.relative(process.cwd(), schemaPath)}`,
      ),
    )

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
          `require('path').join(__dirname, '../node_modules/@prisma/engines/query-engine-${platform}${extension}')`,
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
          version: enginesVersion,
          providerAliases: this.providerAliases,
        },
      },
      binaryPaths: {
        queryEngine: queryEnginePath,
      },
      staticAssetDir,
      versions: {
        prisma2: packageJson.version,
        queryEngine: enginesVersion,
      },
    })

    await studio.start()

    const serverUrl = `http://localhost:${port}`
    if (!browser || browser.toLowerCase() !== 'none') {
      try {
        await open(serverUrl, {
          app: browser,
          url: true,
        })
      } catch (e) {
        // Ignore any errors that occur when trying to open the browser, since they should not halt the process
      }
    }

    this.instance = studio

    return `Prisma Studio is up on ${serverUrl}`
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${Studio.help}`)
    }

    return Studio.help
  }
}
