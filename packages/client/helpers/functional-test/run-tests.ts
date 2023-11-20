import { arg, BinaryType, getPlatform } from '@prisma/internals'
import * as miniProxy from '@prisma/mini-proxy'
import execa, { ExecaChildProcess } from 'execa'
import fs from 'fs'

import { setupQueryEngine } from '../../tests/_utils/setupQueryEngine'
import { isDriverAdapterProviderFlavor, ProviderFlavors, Providers } from '../../tests/functional/_utils/providers'
import { JestCli } from './JestCli'

const allProviders = new Set(Object.values(Providers))
const allProviderFlavors = new Set(Object.values(ProviderFlavors))

// See https://jestjs.io/docs/cli
// Not all Jest params are defined below
// If one is missing and you want to use it, you can add it
const jestArgs = {
  // Whether to use the cache. Defaults to true. Disable the cache using --no-cache.
  '--cache': Boolean,
  '--no-cache': Boolean,
  // Passes the same flag to Jest to only run tests related to changed files
  '--changedFilesWithAncestor': Boolean,
  // Passes the same flag to Jest to only run tests related to changed files
  '--changedSince': String,
  // Passes the same flag to Jest to only run tests related to changed files
  '--onlyChanged': Boolean,
  // Run all tests affected by file changes in the last commit made. Behaves similarly to --onlyChanged.
  '--lastCommit': Boolean,
  // Deletes the Jest cache directory and then exits without running tests.
  '--clearCache': Boolean,
  // Print debugging info about your Jest config.
  '--debug': Boolean,
  // Print the remaining open handles preventing Jest from exiting, implies `--runInBand`.
  '--detectOpenHandles': Boolean,
  // Use this flag to show full diffs and errors instead of a patch.
  '--expand': Boolean,
  '-e': '--expand',
  // Lists all test files that Jest will run given the arguments, and exits.
  '--listTests': Boolean,
  // Lists all test files that Jest will run given the arguments, and exits.
  '--logHeapUsage': Boolean,
  // Logs the heap usage after every test. Useful to debug memory leaks. Use together with --runInBand and --expose-gc in node.
  // Prevents Jest from executing more than the specified amount of tests at the same time. Only affects tests that use test.concurrent.
  '--maxConcurrency': Number,
  // Specifies the maximum number of workers the worker-pool will spawn for running tests.
  '--maxWorkers': Number || String,
  '-w': '--maxWorkers',
  // Disables stack trace in test results output.
  '--noStackTrace': Boolean,
  // Activates notifications for test results.
  '--notify': Boolean,
  // Passes the same flag to Jest to shard tests between multiple machines
  '--shard': String,
  // Passes the same flag to Jest to silence the output
  '--silent': Boolean,
  // Tell Jest to run tests sequentially
  '--runInBand': Boolean,
  // Print your Jest config and then exits.
  '--showConfig': Boolean,
  // Run only tests with a name that matches the regex.
  '--testNamePattern': String,
  '-t': '--testNamePattern',
  // Divert all output to stderr.
  '--useStderr': Boolean,
  // Display individual test results with the test suite hierarchy.
  '--verbose': Boolean,
  // Watch files for changes and rerun tests related to changed files. If you want to re-run all tests when a file has changed, use the --watchAll option instead.
  '--watch': Boolean,
  // Watch files for changes and rerun all tests when something changes. If you want to re-run only the tests that depend on the changed files, use the --watch option.
  '--watchAll': Boolean,
  // Whether to use worker threads for parallelization. Child processes are used by default.
  '--workerThreads': Boolean,
}

const args = arg(
  process.argv.slice(2),
  {
    // Update snapshots
    '--updateSnapshot': Boolean,
    '-u': '--updateSnapshot',
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
    // Forces any given test to be run with `engineType=` binary, library, or wasm
    '--engine-type': String,
    //
    // Jest params
    //
    ...jestArgs,
  },
  false,
  true,
)

async function main(): Promise<number | void> {
  let miniProxyProcess: ExecaChildProcess | undefined

  const jestCliBase = new JestCli(['--config', 'tests/functional/jest.config.js'])
  let jestCli = jestCliBase
  // Pass all the Jest params to Jest CLI
  for (const cliArg of Object.keys(args)) {
    // If it's a boolean, we only need to pass the flag
    if (typeof jestArgs[cliArg] === 'function' && jestArgs[cliArg].name === 'Boolean') {
      jestCli = jestCli.withArgs([cliArg])
    } else if (jestArgs[cliArg]) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      jestCli = jestCli.withArgs([cliArg, args[cliArg]])
    }
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
    const unknownFlavors = providerFlavors.filter((flavor) => !allProviderFlavors.has(flavor))

    if (unknownFlavors.length > 0) {
      throw new Error(`Unknown flavors: ${unknownFlavors.join(', ')}`)
    }

    if (providerFlavors.some(isDriverAdapterProviderFlavor)) {
      jestCli = jestCli.withArgs(['--runInBand'])
      jestCli = jestCli.withEnv({ PRISMA_DISABLE_QUAINT_EXECUTORS: 'true' })
      jestCli = jestCli.withEnv({ TEST_REUSE_DATABASE: 'true' })

      if (args['--data-proxy'] || args['--engine-type'] === 'binary') {
        throw new Error('Driver adapters are not compatible with --data-proxy or --engine-type=binary')
      }
    }

    jestCli = jestCli.withEnv({ ONLY_TEST_PROVIDER_FLAVORS: providerFlavors.join(',') })
  }

  if (args['--engine-type']) {
    jestCli = jestCli.withEnv({ TEST_ENGINE_TYPE: args['--engine-type'] })
    jestCli = jestCli.withEnv({ PRISMA_CLIENT_ENGINE_TYPE: '' })
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

  if (process.env.PRISMA_CLIENT_ENGINE_TYPE && !args['--engine-type']) {
    throw new Error('Functional tests expect --engine-type to be explicitly set, not via env var')
  }

  try {
    if (args['--updateSnapshot']) {
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
