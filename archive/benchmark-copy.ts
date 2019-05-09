import { Suite } from 'benchmark'
import copy from 'fast-copy'
import { dmmfDocument } from '../src/fixtures/example-dmmf'
import v8 from 'v8'

const suite = new Suite()

suite
  .add('fast-copy', () => {
    copy(dmmfDocument)
  })
  .add('v8', () => {
    v8Clone(dmmfDocument)
  })
  .add('JSON.stringify', () => {
    JSON.parse(JSON.stringify(dmmfDocument))
  })
  .on('cycle', function(event) {
    console.log(String(event.target))
  })
  .on('complete', function() {
    console.log('Fastest is ' + this.filter('fastest').map('name'))
  })
  .run()

function v8Clone(obj) {
  // available experimental in node 11
  return v8.deserialize(v8.serialize(obj))
}

/**
 * fast-copy x 5,040 ops/sec ±1.30% (92 runs sampled)
v8 x 1,257 ops/sec ±4.91% (79 runs sampled)
JSON.stringify x 1,951 ops/sec ±1.01% (92 runs sampled)
Fastest is fast-copy

 */
