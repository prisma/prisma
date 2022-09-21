import { fc, testProp } from '@fast-check/jest'

import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace

const digit = fc.oneof(
  fc.constant('0'),
  fc.constant('1'),
  fc.constant('2'),
  fc.constant('3'),
  fc.constant('4'),
  fc.constant('5'),
  fc.constant('6'),
  fc.constant('7'),
  fc.constant('8'),
  fc.constant('9'),
)

const decimalArbitrary = (precision: number, scale: number) => {
  const naturalDigits = fc
    .array(digit, { minLength: 1, maxLength: precision - scale, size: 'max' })
    .map((digits) => digits.join(''))
    .filter((digits) => !digits.startsWith('0'))

  if (scale === 0) {
    return naturalDigits
  }
  const decimalDigits = fc
    .array(digit, { minLength: 1, maxLength: scale, size: 'max' })
    .map((digits) => digits.join(''))
    .filter((digits) => !digits.endsWith('0'))
  return fc.tuple(naturalDigits, decimalDigits).map(([natural, decimal]) => {
    return `${natural}.${decimal}`
  })
}

testMatrix.setupTestSuite(
  ({ precision, scale }) => {
    testProp(
      'decimals should not lose precision when written to db',
      [decimalArbitrary(Number(precision), Number(scale))],
      async (decimalString) => {
        const result = await prisma.testModel.create({
          data: {
            decimal: new Prisma.Decimal(decimalString),
          },
        })
        return result.decimal.toFixed() === decimalString
      },
    )
  },
  {
    optOut: {
      from: ['sqlite', 'mongodb'],
      reason: `
        sqlite - decimals are floating point and not arbitrary precision
        mongo - decimals are not supported
    `,
    },
  },
)
