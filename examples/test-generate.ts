import { dmmfDocument } from '../src/fixtures/example-dmmf'
import { TSClient } from '../src/generation'
import * as fs from 'fs'
import { performance } from 'perf_hooks'

const client = new TSClient(dmmfDocument)

console.clear()
const before = performance.now()
const str = String(client)
const after = performance.now()
console.log(`Generated client in ${(after - before).toFixed(3)}ms`)
fs.writeFileSync(__dirname + '/generated.ts', str)
