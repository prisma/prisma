import { arg } from '@prisma/sdk'

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
    '-p': '--provider',
  },
  true,
  true,
)

let jestCli = new JestCli(['--config', 'tests/functional/jest.config.js'])

if (args['--provider']) {
  const providers = args['--provider'] as Providers[]
  const unknownProviders = providers.filter((provider) => !allProviders.has(provider))
  if (unknownProviders.length > 0) {
    console.error(`Unknown providers: ${unknownProviders.join(', ')}`)
    process.exit(1)
  }
  jestCli = jestCli.withEnv({ ONLY_TEST_PROVIDERS: providers.join(',') })
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
    process.exit(error.exitCode)
  }
  throw error
}
