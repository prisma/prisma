import { enginesVersion } from '@prisma/engines'
import { arg, checkUnsupportedDataProxy, Command, format, HelpError, isError, loadEnvFile } from '@prisma/internals'
import { getSchemaPathAndPrint } from '@prisma/migrate'
import { StudioServer } from '@prisma/studio-server'
import getPort from 'get-port'
import { bold, dim, red } from 'kleur/colors'
import open from 'open'
import path from 'path'

const packageJson = require('../package.json') // eslint-disable-line @typescript-eslint/no-var-requires

export class Studio implements Command {
  public instance?: StudioServer

  public static new(): Studio {
    return new Studio()
  }

  private static help = format(`
Browse your data with Prisma Studio

${bold('Usage')}

  ${dim('$')} prisma studio [options]

${bold('Options')}

  -h, --help        Display this help message
  -p, --port        Port to start Studio on
  -b, --browser     Browser to open Studio in
  -n, --hostname    Hostname to bind the Express server to
  --schema          Custom path to your Prisma schema

${bold('Examples')}

  Start Studio on the default port
    ${dim('$')} prisma studio

  Start Studio on a custom port
    ${dim('$')} prisma studio --port 5555

  Start Studio in a specific browser
    ${dim('$')} prisma studio --port 5555 --browser firefox
    ${dim('$')} BROWSER=firefox prisma studio --port 5555

  Start Studio without opening in a browser
    ${dim('$')} prisma studio --port 5555 --browser none
    ${dim('$')} BROWSER=none prisma studio --port 5555

  Specify a schema
    ${dim('$')} prisma studio --schema=./schema.prisma
`)

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
      '--hostname': String,
      '-n': '--hostname',
      '--schema': String,
      '--telemetry-information': String,
    })

    if (isError(args)) {
      return this.help(args.message)
    }

    await checkUnsupportedDataProxy('studio', args, true)

    if (args['--help']) {
      return this.help()
    }

    loadEnvFile(args['--schema'], true)

    const schemaPath = await getSchemaPathAndPrint(args['--schema'])

    const hostname = args['--hostname']
    const port = args['--port'] || (await getPort({ port: getPort.makeRange(5555, 5600) }))
    const browser = args['--browser'] || process.env.BROWSER

    const staticAssetDir = path.resolve(__dirname, '../build/public')

    const studio = new StudioServer({
      schemaPath,
      hostname,
      port,
      staticAssetDir,
      prismaClient: {
        resolve: {
          '@prisma/client': path.resolve(__dirname, '../prisma-client/index.js'),
        },
      },
      versions: {
        prisma: packageJson.version,
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
      return new HelpError(`\n${bold(red(`!`))} ${error}\n${Studio.help}`)
    }

    return Studio.help
  }
}
