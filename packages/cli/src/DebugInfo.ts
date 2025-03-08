import type { PrismaConfigInternal } from '@prisma/config'
import type { Command } from '@prisma/internals'
import {
  arg,
  format,
  getSchemaWithPath,
  HelpError,
  isCi,
  isError,
  isInteractive,
  link,
  loadEnvFile,
} from '@prisma/internals'
import { bold, dim, red, underline } from 'kleur/colors'

import { getRootCacheDir } from '../../fetch-engine/src/utils'

/**
 * $ prisma debug
 */
export class DebugInfo implements Command {
  static new(): DebugInfo {
    return new DebugInfo()
  }

  private static help = format(`
  Print information helpful for debugging and bug reports

  ${bold('Usage')}

    ${dim('$')} prisma debug [options]

  ${bold('Options')}

    -h, --help     Display this help message
    --config       Custom path to your Prisma config file
    --schema       Custom path to your Prisma schema
`)

  async parse(argv: string[], config: PrismaConfigInternal): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--schema': String,
      '--config': String,
      '--telemetry-information': String,
    })

    if (isError(args)) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    await loadEnvFile({ schemaPath: args['--schema'], printMessage: true, config })

    const formatEnvValue = (name: string, text?: string) => {
      const value = process.env[name]
      const line = `- ${name}${text ? ` ${text}` : ''}`

      if (value === undefined) {
        return dim(`${line}:`)
      }
      return bold(`${line}: \`${value}\``)
    }

    let schemaPath: string | undefined
    try {
      schemaPath = link((await getSchemaWithPath(args['--schema'], config.schema))?.schemaPath)
    } catch (e) {
      schemaPath = e.message
    }
    const rootCacheDir = link(await getRootCacheDir())

    return `${underline('-- Prisma schema --')}
Path: ${schemaPath}

${underline('-- Local cache directory for engines files --')}
Path: ${rootCacheDir}

${underline('-- Environment variables --')}
When not set, the line is dimmed and no value is displayed.
When set, the line is bold and the value is inside the \`\` backticks.

For general debugging
${formatEnvValue('CI')}
${formatEnvValue('DEBUG')}
${formatEnvValue('NODE_ENV')}
${formatEnvValue('RUST_LOG')}
${formatEnvValue('RUST_BACKTRACE')}
${formatEnvValue('NO_COLOR')}
${formatEnvValue('TERM')}
${formatEnvValue('NODE_TLS_REJECT_UNAUTHORIZED')}
${formatEnvValue('NO_PROXY')}
${formatEnvValue('http_proxy')}
${formatEnvValue('HTTP_PROXY')}
${formatEnvValue('https_proxy')}
${formatEnvValue('HTTPS_PROXY')}

For more information about Prisma environment variables:
See ${link('https://www.prisma.io/docs/reference/api-reference/environment-variables-reference')}

For hiding messages
${formatEnvValue('PRISMA_DISABLE_WARNINGS')}
${formatEnvValue('PRISMA_HIDE_PREVIEW_FLAG_WARNINGS')}
${formatEnvValue('PRISMA_HIDE_UPDATE_MESSAGE')}

For downloading engines
${formatEnvValue('PRISMA_ENGINES_MIRROR')}
${formatEnvValue('PRISMA_BINARIES_MIRROR', '(deprecated)')}
${formatEnvValue('PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING')}
${formatEnvValue('BINARY_DOWNLOAD_VERSION')}

For configuring the Query Engine Type
${formatEnvValue('PRISMA_CLI_QUERY_ENGINE_TYPE')}
${formatEnvValue('PRISMA_CLIENT_ENGINE_TYPE')}

For custom engines
${formatEnvValue('PRISMA_QUERY_ENGINE_BINARY')}
${formatEnvValue('PRISMA_QUERY_ENGINE_LIBRARY')}
${formatEnvValue('PRISMA_SCHEMA_ENGINE_BINARY')}
${formatEnvValue('PRISMA_MIGRATION_ENGINE_BINARY')}

For the "postinstall" npm hook
${formatEnvValue('PRISMA_GENERATE_SKIP_AUTOINSTALL')}
${formatEnvValue('PRISMA_SKIP_POSTINSTALL_GENERATE')}
${formatEnvValue('PRISMA_GENERATE_IN_POSTINSTALL')}

For "prisma generate"
${formatEnvValue('PRISMA_GENERATE_DATAPROXY')}
${formatEnvValue('PRISMA_GENERATE_NO_ENGINE')}

For Prisma Client
${formatEnvValue('PRISMA_SHOW_ALL_TRACES')}
${formatEnvValue('PRISMA_CLIENT_NO_RETRY', '(Binary engine only)')}

For Prisma Migrate
${formatEnvValue('PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK')}
${formatEnvValue('PRISMA_MIGRATE_SKIP_GENERATE')}
${formatEnvValue('PRISMA_MIGRATE_SKIP_SEED')}

For Prisma Studio
${formatEnvValue('BROWSER')}

${underline('-- Terminal is interactive? --')}
${isInteractive()}

${underline('-- CI detected? --')}
${isCi()}
`
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${bold(red('!'))} ${error}\n${DebugInfo.help}`)
    }

    return DebugInfo.help
  }
}
