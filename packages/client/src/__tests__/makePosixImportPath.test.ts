import { makePosixImportPath } from '../generation/utils'

test.each([
  ['..\\..\\..\\..\\..\\..\\', 'runtime/index'],
  ['../../../../../../', 'runtime/index'],
])('make posix import path', (a, b) => {
  const result = makePosixImportPath(a, b)
  expect(result).toEqual('../../../../../../runtime/index')
})
