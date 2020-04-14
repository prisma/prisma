import { Suite } from 'benchmark'
import dl from 'damerau-levenshtein-js'
import leven from 'js-levenshtein'
import jaroWinkler from 'jaro-winkler'
import jaro from 'wink-jaro-distance'

const suite = new Suite()

const words = ['title', 'titel', 'string', 'strings', 'nme', 'ahtoe', 'author']

suite
  .add('levenshtein', () => {
    for (const word of words) {
      for (const word2 of words) {
        leven(word, word2)
      }
    }
  })
  .add('damerau levenshtein', () => {
    for (const word of words) {
      for (const word2 of words) {
        dl.distance(word, word2)
      }
    }
  })
  .add('jaro', () => {
    for (const word of words) {
      for (const word2 of words) {
        jaro(word, word2)
      }
    }
  })
  .add('jaro-winkler', () => {
    for (const word of words) {
      for (const word2 of words) {
        jaroWinkler(word, word2)
      }
    }
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
