import os from 'os'

import { makeRuntimeImportPath } from '../generation/utils'

const testIf = (condition: boolean): typeof test => (condition ? test : test.skip)

test.each([
  ['../../../../../../', 'runtime/index', './../../../../../../runtime/index'],
  ['.', '@prisma/client', '@prisma/client'],
])('make runtime import path', (a, b, expected) => {
  const result = makeRuntimeImportPath(a, b)
  // eslint-disable-next-line jest/no-standalone-expect
  expect(result).toEqual(expected)
})

testIf(os.platform() === 'win32').each([
  ['..\\..\\..\\..\\..\\..\\', 'runtime/index', './../../../../../../runtime/index'],
])('make runtime import path win32', (a, b, expected) => {
  const result = makeRuntimeImportPath(a, b)
  // eslint-disable-next-line jest/no-standalone-expect
  expect(result).toEqual(expected)
})

testIf(os.platform() !== 'win32').each([
  ['../../../../../../', 'ru\\ntime/index', './../../../../../../ru\\ntime/index'],
])('make runtime import path linux with backslashes in path', (a, b, expected) => {
  const result = makeRuntimeImportPath(a, b)
  // eslint-disable-next-line jest/no-standalone-expect
  expect(result).toEqual(expected)
})
