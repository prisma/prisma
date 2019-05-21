import { Suite } from 'benchmark'
import copy from 'fast-copy'
import clone from 'fast-clone'
import { dmmfDocument } from '../src/fixtures/example-dmmf'
import v8 from 'v8'

const suite = new Suite()

suite
  .add('fast-copy', () => {
    copy(dmmfDocument)
  })
  .add('fast-clone', () => {
    clone(dmmfDocument)
  })
  // .add('v8', () => {
  //   v8Clone(dmmfDocument)
  // })
  .add('JSON.stringify', () => {
    JSON.parse(JSON.stringify(dmmfDocument))
  })
  .add('assignunLink', () => {
    assignunlink({}, dmmfDocument)
  })
  .on('cycle', function(event) {
    console.log(String(event.target))
  })
  .on('complete', function() {
    console.log('Fastest is ' + this.filter('fastest').map('name'))
  })
  .run()

/**
 * fast-copy x 5,040 ops/sec ±1.30% (92 runs sampled)
v8 x 1,257 ops/sec ±4.91% (79 runs sampled)
JSON.stringify x 1,951 ops/sec ±1.01% (92 runs sampled)
Fastest is fast-copy

 */
function assignunlink(target, ...args: any[]) {
  target = target instanceof Object ? target : {}

  for (let a = 1, al = arguments.length; a < al; a++) {
    let object: any = arguments[a]
    if (object) {
      for (let prop in object) {
        if (object.hasOwnProperty(prop) === true) {
          let ovalue = object[prop]
          if (Array.isArray(ovalue)) {
            target[prop] = []
            assignunlink(target[prop], object[prop])
          } else if (String(ovalue) === '[object Object]') {
            target[prop] = {}
            assignunlink(target[prop], object[prop])
          } else {
            target[prop] = object[prop]
          }
        }
      }
    }
  }

  return target
}

/**
 * fast-copy x 3,548 ops/sec ±0.75% (93 runs sampled)
   v8 x 996 ops/sec ±4.19% (81 runs sampled)
   JSON.stringify x 1,544 ops/sec ±0.64% (93 runs sampled)
   assignunLink x 3,387 ops/sec ±2.65% (93 runs sampled)
   Fastest is fast-copy
 */
