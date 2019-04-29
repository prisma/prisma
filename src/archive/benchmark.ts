import { Suite } from 'benchmark'

const suite = new Suite()

const arr = new Array(100).fill(0)

suite
  .add('for', () => {
    for (const x of arr) {
      1 + 1 + x
    }
  })
  .add('forEach', () => {
    arr.forEach(x => {
      1 + 1 + x
    })
  })
  .on('cycle', function(event) {
    console.log(String(event.target))
  })
  .on('complete', function() {
    console.log('Fastest is ' + this.filter('fastest').map('name'))
  })
  // run async
  .run()
