import { Suite } from 'benchmark'
import immutableO from 'object-path-immutable'
import { setIn } from 'immutable'
import { deepSet } from '../src/utils/deep-set'

const suite = new Suite()

const obj = {
  createUser: {
    data: {
      post: {
        create: {},
      },
    },
  },
}

suite
  .add('object-path-immutable', () => {
    immutableO(obj).set('createUser.data.post.create.title', 'String')
  })
  .add('immutable', () => {
    setIn(obj, 'createUser.data.post.create.title'.split('.'), 'String')
  })
  .add('deepSet', () => {
    deepSet(obj, 'createUser.data.post.create.title', 'String')
  })
  .on('cycle', function(event) {
    console.log(String(event.target))
  })
  .on('complete', function() {
    console.log('Fastest is ' + this.filter('fastest').map('name'))
  })
  .run()
