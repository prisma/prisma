import { dmmfDocument } from '../fixtures/example-dmmf'
import { TSClient } from '../generate'
import * as fs from 'fs'
import { performance } from 'perf_hooks'

const client = new TSClient(dmmfDocument)

console.clear()
const before = performance.now()
const str = String(client)
const after = performance.now()
console.log(`Generated client in ${(after - before).toFixed(3)}ms`)
fs.writeFileSync(__dirname + '/generated.ts', str)
