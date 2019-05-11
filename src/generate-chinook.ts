import { TSClient } from './generate'
import * as fs from 'fs'
import { performance } from 'perf_hooks'
import { getDMMF } from './utils/getDMMF'
// import { sportsdb } from './datamodels/sportsdb'
import { chinook } from './datamodels/chinook'

const client = new TSClient(getDMMF(chinook))

console.clear()
const before = performance.now()
const str = String(client)
const after = performance.now()
console.log(`Generated client in ${(after - before).toFixed(3)}ms`)
fs.writeFileSync(__dirname + '/generated-chinook.ts', str)
