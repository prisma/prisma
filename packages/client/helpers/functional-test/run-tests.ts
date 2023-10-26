import { arg, BinaryType, getPlatform } from '@prisma/internals'
import * as miniProxy from '@prisma/mini-proxy'
import execa, { ExecaChildProcess } from 'execa'
import fs from 'fs'

import { setupQueryEngine } from '../../tests/_utils/setupQueryEngine'
import { isDriverAdapterProviderFlavor, ProviderFlavors, Providers } from '../../tests/functional/_utils/providers'
import { JestCli } from './JestCli'

const allProviders = new Set(Object.values(Providers))
const allProviderFlavors = new Set(Object.values(ProviderFlavors))

const args = arg(
  process.argv.slice(2),
  {
    // Update snapshots
    '-u': Boolean,
    // Only run the tests, don't typecheck
    '--no-types': Boolean,
    // Only typecheck, don't run the code tests
    '--types-only': Boolean,
    // Generates all the clients to run the type tests
    '--generate-only': Boolean,
    // Restrict the list of providers (does not run --flavor by default)
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
    // Run tests for specific provider flavors (and excludes regular provider tests)
    '--flavor': [String],
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
    // Passes the same flag to Jest to silence the output
    '--silent': Boolean,
    // Tell Jest to run tests sequentially
    '--runInBand': Boolean,
  },
  true,
  true,
)

async function main(): Promise<number | void> {
  const jestCliBase = new JestCli(['--config', 'tests/functional/jest.config.js'])
  let miniProxyProcess: ExecaChildProcess | undefined

  let jestCli = jestCliBase

  if (args['--runInBand']) {
    jestCli = jestCli.withArgs(['--runInBand'])
  }

  if (args['--provider']) {
    const providers = args['--provider'] as Providers[]
    const unknownProviders = providers.filter((provider) => !allProviders.has(provider))
    if (unknownProviders.length > 0) {
      throw new Error(`Unknown providers: ${unknownProviders.join(', ')}`)
    }
    jestCli = jestCli.withEnv({ ONLY_TEST_PROVIDERS: providers.join(',') })
  }

  if (args['--flavor']) {
    const providerFlavors = args['--flavor'] as ProviderFlavors[]
    const unknownFlavor = providerFlavors.filter((flavor) => !allProviderFlavors.has(flavor))
    if (unknownFlavor.length > 0) {
      throw new Error(`Unknown flavors: ${unknownFlavor.join(', ')}`)
    }

    if (providerFlavors.some(isDriverAdapterProviderFlavor)) {
      jestCli = jestCli.withArgs(['--runInBand'])
      jestCli = jestCli.withEnv({ PRISMA_DISABLE_QUAINT_EXECUTORS: 'true' })
      jestCli = jestCli.withEnv({ TEST_REUSE_DATABASE: 'true' })

      if (args['--data-proxy'] || process.env.PRISMA_CLIENT_ENGINE_TYPE === 'binary') {
        throw new Error('Driver adapters are not compatible with --data-proxy or the binary engine')
      }
    }

    jestCli = jestCli.withEnv({ ONLY_TEST_PROVIDER_FLAVORS: providerFlavors.join(',') })
  }

  if (args['--data-proxy']) {
    if (!fs.existsSync(miniProxy.defaultServerConfig.cert)) {
      await miniProxy.generateCertificates(miniProxy.defaultCertificatesConfig)
    }

    jestCli = jestCli.withEnv({
      TEST_DATA_PROXY: 'true',
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

  // See flag description above.
  // If the flag is not provided we want to ignore `relationMode` tests
  if (args['--relation-mode-tests-only']) {
    jestCli = jestCli.withArgs(['--runInBand'])
    jestCli = jestCli.withEnv({ TEST_REUSE_DATABASE: 'true' })
  } else {
    jestCli = jestCli.withArgs(['--testPathIgnorePatterns', 'relationMode-in-separate-gh-action'])
  }

  if (args['--onlyChanged']) {
    jestCli = jestCli.withArgs(['--onlyChanged'])
  }
  if (args['--changedSince']) {
    jestCli = jestCli.withArgs(['--changedSince', args['--changedSince']])
  }
  if (args['--shard']) {
    jestCli = jestCli.withArgs(['--shard', args['--shard']])
  }
  if (args['--silent']) {
    jestCli = jestCli.withArgs(['--silent'])
  }

  try {
    if (args['-u']) {
      const snapshotUpdate = jestCli.withArgs(['-u']).withArgs(args['_'])
      snapshotUpdate.withEnv({ UPDATE_SNAPSHOTS: 'inline' }).run()
      snapshotUpdate.withEnv({ UPDATE_SNAPSHOTS: 'external' }).run()
    } else {
      if (!args['--types-only']) {
        jestCli
          .withArgs(['--testPathIgnorePatterns', 'typescript', '--', args['_']])
          .withEnv({ TEST_GENERATE_ONLY: args['--generate-only'] ? 'true' : 'false' })
          .run()
      }

      if (!args['--no-types']) {
        // Disable JUnit output for typescript tests
        jestCliBase.withArgs(['--', 'typescript']).withEnv({ JEST_JUNIT_DISABLE: 'true' }).run()
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
  const qePath = paths[BinaryType.QueryEngineBinary]?.[platform]

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
