// @ts-ignore

import testMatrix from './_matrix'

testMatrix.setupTestSuite(() => {
  test('should fail', () => {
    expect(false).toEqual(true)
  })
})
