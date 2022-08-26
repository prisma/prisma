import { arg, BinaryType, getPlatform } from '@prisma/internals'
import * as miniProxy from '@prisma/mini-proxy'
import execa, { ExecaChildProcess } from 'execa'
import fs from 'fs'

import { setupQueryEngine } from '../../tests/commonUtils/setupQueryEngine'
import { Providers } from '../../tests/functional/_utils/providers'
import { JestCli } from './JestCli'

const allProviders = new Set(Object.values(Providers))

const args = arg(
  process.argv.slice(2),
  {
    '-u': Boolean,
    '--no-types': Boolean,
    '--types-only': Boolean,
    '--provider': [String],
    '--data-proxy': Boolean,
    '--no-mini-proxy': Boolean,
    '--mini-proxy-debug': Boolean,
    '-p': '--provider',
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
      NODE_EXTRA_CA_CERTS: miniProxy.defaultCertificatesConfig.caCert,
    })

    if (!args['--no-mini-proxy']) {
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

  const codeTestCli = jestCli.withArgs(['--testPathIgnorePatterns', 'typescript'])

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
