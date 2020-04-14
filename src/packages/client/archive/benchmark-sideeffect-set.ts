import { Suite } from 'benchmark'
import setValue from 'set-value'
import set from '@strikeentco/set'

const suite = new Suite()

suite
  .add('set-value', () => {
    const obj = {
      createUser: {
        data: {
          post: {
            create: {},
          },
        },
      },
    }
    setValue(obj, 'createUser.data.post.create.title', 'String')
  })
  .add('@strikeentco/set', () => {
    const obj = {
      createUser: {
        data: {
          post: {
            create: {},
          },
        },
      },
    }
    set(obj, 'createUser.data.post.create.title', 'String')
  })
  .on('cycle', function(event) {
    console.log(String(event.target))
  })
  .on('complete', function() {
    console.log('Fastest is ' + this.filter('fastest').map('name'))
  })
  // run async
  .run()

/**
   * Results:
   * levenshtein x 223,459 ops/sec ±0.43% (96 runs sampled)
damerau levenshtein x 17,503 ops/sec ±0.48% (93 runs sampled)
jaro x 185,553 ops/sec ±0.92% (92 runs sampled)
jaro-winkler x 160,204 ops/sec ±0.55% (95 runs sampled)
jaro_winkler x 15,306 ops/sec ±0.45% (94 runs sampled)
Fastest is levenshtein

   */
