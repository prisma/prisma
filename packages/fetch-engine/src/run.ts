#!/usr/bin/env node

import { ensureQueryEngineBinary } from './ensureBinaries'

ensureQueryEngineBinary(process.argv.length > 2 ? process.argv[2] : undefined).catch(console.error)
