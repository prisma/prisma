#!/usr/bin/env node

import { cliDistributionIdentity } from './utils/cli-distribution-identity'

void cliDistributionIdentity

if (process.argv[2] === 'complete') {
  require('./completion.js')
} else {
  require('./cli.js')
}
