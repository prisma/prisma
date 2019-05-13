import { Suite } from 'benchmark'
import objectAssignDeep from 'object-assign-deep'
import mergeDeep from 'merge-deep'
import { default as deepExtendNpm } from 'deep-extend'
import { deepExtend } from '../src/utils/deep-extend'

const suite = new Suite()

suite
  .add('object-assign-deep', () => {
    const obj = {
      createUser: {
        select: {
          a: true,
          b: true,
          c: true,
        },
      },
    }

    const select = {
      createUser: {
        select: {
          a: false,
          b: true,
          d: {
            e: true,
          },
        },
      },
    }
    objectAssignDeep(obj, select)
  })
  .add('merge-deep', () => {
    const obj = {
      createUser: {
        select: {
          a: true,
          b: true,
          c: true,
        },
      },
    }

    const select = {
      createUser: {
        select: {
          a: false,
          b: true,
          d: {
            e: true,
          },
        },
      },
    }
    mergeDeep(obj, select)
  })
  .add('deep-extend', () => {
    const obj = {
      createUser: {
        select: {
          a: true,
          b: true,
          c: true,
        },
      },
    }

    const select = {
      createUser: {
        select: {
          a: false,
          b: true,
          d: {
            e: true,
          },
        },
      },
    }
    deepExtendNpm(obj, select)
  })
  .add('deep-extend-es2017', () => {
    const obj = {
      createUser: {
        select: {
          a: true,
          b: true,
          c: true,
        },
      },
    }

    const select = {
      createUser: {
        select: {
          a: false,
          b: true,
          d: {
            e: true,
          },
        },
      },
    }
    deepExtend(obj, select)
  })
  .on('cycle', function(event) {
    console.log(String(event.target))
  })
  .on('complete', function() {
    console.log('Fastest is ' + this.filter('fastest').map('name'))
  })
  .run()

/**
 * object-assign-deep x 578,965 ops/sec ±0.62% (95 runs sampled)
merge-deep x 394,256 ops/sec ±0.87% (89 runs sampled)
deep-extend x 612,662 ops/sec ±1.00% (89 runs sampled)
deep-extend-es2017 x 1,535,660 ops/sec ±0.47% (98 runs sampled)

 */
