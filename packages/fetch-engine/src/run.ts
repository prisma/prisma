#!/usr/bin/env node

import { ensureBinaries } from './ensurebinaries'

ensureBinaries(process.argv.length > 2 ? process.argv[2] : undefined).catch(console.error)
