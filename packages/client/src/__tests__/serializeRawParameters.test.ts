import { serializeRawParameters } from '../runtime/utils/serializeRawParameters'
function serializeHelper(data: any) {
  return JSON.parse(serializeRawParameters(data))
}
describe('serializeRawParemeters', () => {
  test('object', () => {
    const data = {
      date: new Date('2020-06-22T17:07:16.348Z'),
      bigInt: BigInt('321804719213721'),
    }

    expect(serializeHelper(data)).toMatchInlineSnapshot(`
      Object {
        bigInt: 202012310000001,
        date: Object {
          prisma__type: date,
          prisma__value: 2020-06-22T17:07:16.348Z,
        },
      }
    `)
  })

  test('array', () => {
    const data = {
      date: [new Date('2020-06-22T17:07:16.348Z')],
      bigInt: [BigInt('321804719213721')],
    }

    expect(serializeHelper(data)).toMatchInlineSnapshot(`
      Object {
        bigInt: Array [
          202012310000001,
        ],
        date: Array [
          Object {
            prisma__type: date,
            prisma__value: 2020-06-22T17:07:16.348Z,
          },
        ],
      }
    `)
  })

  test('scalar date', () => {
    const data = new Date('2020-06-22T17:07:16.348Z')

    expect(serializeHelper(data)).toMatchInlineSnapshot(`
      Object {
        prisma__type: date,
        prisma__value: 2020-06-22T17:07:16.348Z,
      }
    `)
  })

  test('scalar bigInt', () => {
    const data = BigInt('321804719213721')

    expect(serializeHelper(data)).toMatchInlineSnapshot(`202012310000001`)
  })

  test('nested', () => {
    const data = {
      deep: {
        date: [new Date('2020-06-22T17:07:16.348Z'), new Date('2020-06-22T17:07:16.348Z')],
        bigInt: [BigInt('321804719213721'), BigInt('321804719213721')],
      },
    }

    expect(serializeHelper(data)).toMatchInlineSnapshot(`
      Object {
        deep: Object {
          bigInt: Array [
            202012310000001,
            202012310000001,
          ],
          date: Array [
            Object {
              prisma__type: date,
              prisma__value: 2020-06-22T17:07:16.348Z,
            },
            Object {
              prisma__type: date,
              prisma__value: 2020-06-22T17:07:16.348Z,
            },
          ],
        },
      }
    `)
  })
})
