#!/usr/bin/env node

import { initializeCliDistributionIdentity } from './utils/cli-distribution-identity'

initializeCliDistributionIdentity()

if (process.argv[2] === 'complete') {
  require('./completion.js')
} else {
  require('./cli.js')
}
