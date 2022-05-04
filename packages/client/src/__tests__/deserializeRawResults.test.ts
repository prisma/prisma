import { deserializeRawResults } from '../runtime/utils/deserializeRawResults'

describe('deserializeRawResults', () => {
  test('int', () => {
    expect(
      deserializeRawResults([
        {
          a: {
            prisma__type: 'int',
            prisma__value: 42,
          },
        },
      ]),
    ).toEqual([
      {
        a: 42,
      },
    ])
  })

  test('bigint', () => {
    expect(
      deserializeRawResults([
        {
          a: {
            prisma__type: 'bigint',
            prisma__value: '10000',
          },
        },
      ]),
    ).toEqual([
      {
        a: BigInt(10000),
      },
    ])
  })

  test('floating point', () => {
    expect(
      deserializeRawResults([
        {
          a: {
            prisma__type: 'float',
            prisma__value: 1.5,
          },
          b: {
            prisma__type: 'double',
            prisma__value: 0.5,
          },
        },
      ]),
    ).toEqual([
      {
        a: 1.5,
        b: 0.5,
      },
    ])
  })

  test('string', () => {
    expect(
      deserializeRawResults([
        {
          a: {
            prisma__type: 'string',
            prisma__value: 'hello',
          },
        },
      ]),
    ).toEqual([
      {
        a: 'hello',
      },
    ])
  })

  test('enum', () => {
    expect(
      deserializeRawResults([
        {
          a: {
            prisma__type: 'enum',
            prisma__value: 'value',
          },
        },
      ]),
    ).toEqual([
      {
        a: 'value',
      },
    ])
  })

  test('bytes', () => {
    expect(
      deserializeRawResults([
        {
          a: {
            prisma__type: 'bytes',
            prisma__value: 'Ynl0ZXM=',
          },
        },
      ]),
    ).toEqual([
      {
        a: Buffer.from('bytes'),
      },
    ])
  })

  test('bool', () => {
    expect(
      deserializeRawResults([
        {
          a: {
            prisma__type: 'bool',
            prisma__value: true,
          },
          b: {
            prisma__type: 'bool',
            prisma__value: false,
          },
        },
      ]),
    ).toEqual([
      {
        a: true,
        b: false,
      },
    ])
  })

  test('null', () => {
    expect(
      deserializeRawResults([
        {
          a: {
            prisma__type: 'null',
            prisma__value: null,
          },
        },
      ]),
    ).toEqual([
      {
        a: null,
      },
    ])
  })

  test('json', () => {
    expect(
      deserializeRawResults([
        {
          a: {
            prisma__type: 'json',
            prisma__value: {
              a: 1,
              b: [2],
            },
          },
        },
      ]),
    ).toEqual([
      {
        a: {
          a: 1,
          b: [2],
        },
      },
    ])
  })

  test('date and time', () => {
    expect(
      deserializeRawResults([
        {
          a: {
            prisma__type: 'datetime',
            prisma__value: '2022-01-01T00:00:00.000Z',
          },
          b: {
            prisma__type: 'date',
            prisma__value: '2022-01-01',
          },
          c: {
            prisma__type: 'time',
            prisma__value: '00:00:00.000',
          },
        },
      ]),
    ).toEqual([
      {
        a: new Date('2022-01-01T00:00:00.000Z'),
        b: '2022-01-01',
        c: '00:00:00.000',
      },
    ])
  })

  test('unsupported', () => {
    expect(
      deserializeRawResults([
        {
          a: {
            prisma__type: 'char',
            prisma__value: 'a',
          },
          b: {
            prisma__type: 'xml',
            prisma__value: '<xml></xml>',
          },
          c: {
            prisma__type: 'uuid',
            prisma__value: '00000000-0000-0000-0000-000000000000',
          },
        },
      ]),
    ).toEqual([
      {
        a: 'a',
        b: '<xml></xml>',
        c: '00000000-0000-0000-0000-000000000000',
      },
    ])
  })

  test('array', () => {
    expect(
      deserializeRawResults([
        {
          a: {
            prisma__type: 'array',
            prisma__value: [
              {
                prisma__type: 'int',
                prisma__value: 1,
              },
              {
                prisma__type: 'int',
                prisma__value: 2,
              },
            ],
          },
        },
      ]),
    ).toEqual([
      {
        a: [1, 2],
      },
    ])
  })
})
