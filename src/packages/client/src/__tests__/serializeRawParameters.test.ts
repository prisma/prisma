import { replaceDates } from '../runtime/utils/serializeRawParameters'

test('serializeRawParemeters object', () => {
  const data = {
    date: new Date('2020-06-22T17:07:16.348Z'),
  }

  expect(replaceDates(data)).toMatchInlineSnapshot(`
    Object {
      "date": Object {
        "prisma__type": "date",
        "prisma__value": "2020-06-22T17:07:16.348Z",
      },
    }
  `)
})

test('serializeRawParemeters array', () => {
  const data = {
    date: [new Date('2020-06-22T17:07:16.348Z')],
  }

  expect(replaceDates(data)).toMatchInlineSnapshot(`
    Object {
      "date": Array [
        Object {
          "prisma__type": "date",
          "prisma__value": "2020-06-22T17:07:16.348Z",
        },
      ],
    }
  `)
})

test('serializeRawParemeters scalar', () => {
  const data = new Date('2020-06-22T17:07:16.348Z')

  expect(replaceDates(data)).toMatchInlineSnapshot(`
    Object {
      "prisma__type": "date",
      "prisma__value": "2020-06-22T17:07:16.348Z",
    }
  `)
})

test('serializeRawParemeters nested', () => {
  const data = {
    deep: {
      date: [
        new Date('2020-06-22T17:07:16.348Z'),
        new Date('2020-06-22T17:07:16.348Z'),
      ],
    },
  }

  expect(replaceDates(data)).toMatchInlineSnapshot(`
    Object {
      "deep": Object {
        "date": Array [
          Object {
            "prisma__type": "date",
            "prisma__value": "2020-06-22T17:07:16.348Z",
          },
          Object {
            "prisma__type": "date",
            "prisma__value": "2020-06-22T17:07:16.348Z",
          },
        ],
      },
    }
  `)
})
