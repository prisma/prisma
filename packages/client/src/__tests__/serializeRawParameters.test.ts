import { serializeRawParameters } from '../runtime/utils/serializeRawParameters'

function serializeHelper(data: any) {
  return JSON.parse(serializeRawParameters(data))
}

describe('serializeRawParameters', () => {
  test('object', () => {
    const data = {
      date: new Date('2020-06-22T17:07:16.348Z'),
      bigInt: BigInt('321804719213721'),
    }

    expect(serializeHelper(data)).toEqual({
      bigInt: '321804719213721',
      date: {
        prisma__type: 'date',
        prisma__value: '2020-06-22T17:07:16.348Z',
      },
    })
  })

  test('array', () => {
    const data = {
      date: [new Date('2020-06-22T17:07:16.348Z')],
      bigInt: [BigInt('321804719213721')],
    }

    expect(serializeHelper(data)).toEqual({
      bigInt: ['321804719213721'],
      date: [
        {
          prisma__type: 'date',
          prisma__value: '2020-06-22T17:07:16.348Z',
        },
      ],
    })
  })

  test('scalar date', () => {
    const data = new Date('2020-06-22T17:07:16.348Z')

    expect(serializeHelper(data)).toEqual({
      prisma__type: 'date',
      prisma__value: '2020-06-22T17:07:16.348Z',
    })
  })

  test('scalar bigInt', () => {
    const data = BigInt('321804719213721')

    expect(serializeHelper(data)).toEqual('321804719213721')
  })

  test('nested', () => {
    const data = {
      deep: {
        date: [new Date('2020-06-22T17:07:16.348Z'), new Date('2020-06-22T17:07:16.348Z')],
        bigInt: [BigInt('321804719213721'), BigInt('321804719213721')],
      },
    }

    expect(serializeHelper(data)).toEqual({
      deep: {
        bigInt: ['321804719213721', '321804719213721'],
        date: [
          {
            prisma__type: 'date',
            prisma__value: '2020-06-22T17:07:16.348Z',
          },
          {
            prisma__type: 'date',
            prisma__value: '2020-06-22T17:07:16.348Z',
          },
        ],
      },
    })
  })
})
