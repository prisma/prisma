import Decimal from 'decimal.js'

import { serializeRawParameters } from '../runtime/utils/serializeRawParameters'

function serialize(data: any[]) {
  return JSON.parse(serializeRawParameters(data))
}

describe('serializeRawParameters', () => {
  test('empty', () => {
    expect(serialize([])).toEqual([])
  })

  test('primitives', () => {
    const data = [0, 1, true, false, '', 'hi', null, undefined]
    expect(serialize(data)).toEqual([0, 1, true, false, '', 'hi', null, null])
  })

  test('date', () => {
    const data = [new Date('2020-06-22T17:07:16.348Z')]

    expect(serialize(data)).toEqual([
      {
        prisma__type: 'date',
        prisma__value: '2020-06-22T17:07:16.348Z',
      },
    ])
  })

  test('BigInt', () => {
    const data = [BigInt('321804719213721')]

    expect(serialize(data)).toEqual(['321804719213721'])
  })

  test('Decimal', () => {
    const data = [new Decimal(1.1)]

    expect(serialize(data)).toEqual([
      {
        prisma__type: 'decimal',
        prisma__value: '1.1',
      },
    ])
  })

  test('Buffer', () => {
    const data = [Buffer.from('hello')]

    expect(serialize(data)).toEqual([
      {
        prisma__type: 'bytes',
        prisma__value: 'aGVsbG8=',
      },
    ])
  })

  // Objects are serialized as-is, except for BigInts which are serialized as
  // strings because otherwise JSON.stringify would throw TypeError.
  test('object', () => {
    const data = [
      {
        text: 'text',
        number: 1,
      },
      {
        date: new Date('2020-06-22T17:07:16.348Z'),
        bigInt: BigInt('321804719213721'),
        buffer: Buffer.from('hello'),
      },
      {
        nested: {
          array: [new Date('2020-06-22T17:07:16.348Z'), BigInt('321804719213721')],
        },
      },
      [123, BigInt('321804719213721')],
    ]

    expect(serialize(data)).toEqual([
      {
        text: 'text',
        number: 1,
      },
      {
        date: '2020-06-22T17:07:16.348Z',
        bigInt: '321804719213721',
        buffer: { type: 'Buffer', data: [104, 101, 108, 108, 111] },
      },
      {
        nested: {
          array: ['2020-06-22T17:07:16.348Z', '321804719213721'],
        },
      },
      [123, '321804719213721'],
    ])
  })
})
