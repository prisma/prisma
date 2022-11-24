import { createCompositeProxy } from './createCompositeProxy'
import { removeProperties } from './removeProperties'

test('removes specified properties', () => {
  const target = { someProp: 1, secret: 'Do not tell anybody' }

  const proxy = createCompositeProxy(target, [removeProperties(['secret'])])

  expect(proxy).not.toHaveProperty('secret')
  expect(Object.keys(proxy)).toEqual(['someProp'])
  expect(proxy['secret']).toBeUndefined()
})
