import { arg, BinaryType, getPlatform } from '@prisma/internals'
import * as miniProxy from '@prisma/mini-proxy'
import execa, { ExecaChildProcess } from 'execa'
import fs from 'fs'

import { setupQueryEngine } from '../../tests/_utils/setupQueryEngine'
import { Providers } from '../../tests/functional/_utils/providers'
import { JestCli } from './JestCli'

const allProviders = new Set(Object.values(Providers))

const args = arg(
  process.argv.slice(2),
  {
    // Update snapshots
    '-u': Boolean,
    // Only run the tests, don't typecheck
    '--no-types': Boolean,
    // Only typecheck, don't run the code tests
    '--types-only': Boolean,
    // Restrict the list of providers
    '--provider': [String],
    '-p': '--provider',
    // Generate Data Proxy client and run tests using Mini-Proxy
    '--data-proxy': Boolean,
    // Use edge client (requires --data-proxy)
    '--edge-client': Boolean,
    // Don't start the Mini-Proxy server and don't override NODE_EXTRA_CA_CERTS. You need to start the Mini-Proxy server
    // externally on the default port and run `eval $(mini-proxy env)` in your shell before starting the tests.
    '--no-mini-proxy-server': Boolean,
    // Enable debug logs in the bundled Mini-Proxy server
    '--mini-proxy-debug': Boolean,
    // Since `relationMode-in-separate-gh-action` tests need to be run with 2 different values
    // `foreignKeys` and `prisma`
    // We run them separately in a GitHub Action matrix for now
    // Also the typescript tests fail and it might not be easily fixable
    // This flag is used for this purpose
    '--relation-mode-tests-only': Boolean,
    //
    // Jest flags
    //
    // Passes the same flag to Jest to only run tests related to changed files
    '--onlyChanged': Boolean,
    // Passes the same flag to Jest to only run tests related to changed files
    '--changedSince': String,
    // Passes the same flag to Jest to only run tests related to changed files
    '--changedFilesWithAncestor': Boolean,
    // Passes the same flag to Jest to shard tests between multiple machines
    '--shard': String,
  },
  true,
  true,
)

async function main(): Promise<number | void> {
  let jestCli = new JestCli(['--verbose', '--config', 'tests/functional/jest.config.js'])
  let miniProxyProcess: ExecaChildProcess | undefined

  if (args['--provider']) {
    const providers = args['--provider'] as Providers[]
    const unknownProviders = providers.filter((provider) => !allProviders.has(provider))
    if (unknownProviders.length > 0) {
      console.error(`Unknown providers: ${unknownProviders.join(', ')}`)
      process.exit(1)
    }
    jestCli = jestCli.withEnv({ ONLY_TEST_PROVIDERS: providers.join(',') })
  }

  if (args['--data-proxy']) {
    if (!fs.existsSync(miniProxy.defaultServerConfig.cert)) {
      await miniProxy.generateCertificates(miniProxy.defaultCertificatesConfig)
    }

    jestCli = jestCli.withEnv({
      DATA_PROXY: 'true',
    })

    if (args['--edge-client']) {
      jestCli = jestCli.withEnv({
        TEST_DATA_PROXY_EDGE_CLIENT: 'true',
      })
    }

    if (!args['--no-mini-proxy-server']) {
      jestCli = jestCli.withEnv({
        NODE_EXTRA_CA_CERTS: miniProxy.defaultCertificatesConfig.caCert,
      })

      const qePath = await getBinaryForMiniProxy()

      miniProxyProcess = execa('mini-proxy', ['server', '-q', qePath], {
        preferLocal: true,
        stdio: 'inherit',
        env: {
          DEBUG: args['--mini-proxy-debug'] ? 'mini-proxy:*' : process.env.DEBUG,
        },
      })
    }
  }

  if (args['--edge-client'] && !args['--data-proxy']) {
    throw new Error('--edge-client is only available when --data-proxy is used')
  }

  const jestArgs = ['--testPathIgnorePatterns', 'typescript']

  // See flag description above.
  // If the flag is not provided we want to ignore `relationMode` tests
  if (!args['--relation-mode-tests-only']) {
    jestArgs.push('--testPathIgnorePatterns', 'relationMode-in-separate-gh-action')
  } else {
    jestArgs.push('--runInBand')
  }

  if (args['--onlyChanged']) {
    jestArgs.push('--onlyChanged')
  }
  if (args['--changedSince']) {
    jestArgs.push('--changedSince', args['--changedSince'])
  }
  if (args['--shard']) {
    jestArgs.push('--shard', args['--shard'])
  }
  const codeTestCli = jestCli.withArgs(jestArgs)

  try {
    if (args['-u']) {
      const snapshotUpdate = codeTestCli.withArgs(['-u']).withArgs(args['_'])
      snapshotUpdate.withEnv({ UPDATE_SNAPSHOTS: 'inline' }).run()
      snapshotUpdate.withEnv({ UPDATE_SNAPSHOTS: 'external' }).run()
    } else {
      if (!args['--types-only']) {
        codeTestCli.withArgs(['--']).withArgs(args['_']).run()
      }

      if (!args['--no-types']) {
        // Disable JUnit output for typescript tests
        process.env.JEST_JUNIT_DISABLE = 'true'
        jestCli.withArgs(['--', 'typescript']).run()
      }
    }
  } catch (error) {
    if (error.exitCode) {
      // If it's execa error, exit without logging: we
      // already have output from jest
      return error.exitCode
    }
    throw error
  } finally {
    if (miniProxyProcess) {
      miniProxyProcess.kill()
    }
  }
}

async function getBinaryForMiniProxy(): Promise<string> {
  if (process.env.PRISMA_QUERY_ENGINE_BINARY) {
    return process.env.PRISMA_QUERY_ENGINE_BINARY
  }

  const paths = await setupQueryEngine()
  const platform = await getPlatform()
  const qePath = paths[BinaryType.queryEngine]?.[platform]

  if (!qePath) {
    throw new Error('Query Engine binary missing')
  }

  return qePath
}

void main().then((code) => {
  if (code) {
    process.exit(code)
  }
})
