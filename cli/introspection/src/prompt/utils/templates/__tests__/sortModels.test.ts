import { sortModels } from '../sortModels'
import { DMMF } from '@prisma/generator-helper'

test('sortModels', () => {
  const models: DMMF.Model[] = [
    {
      name: 'Car',
      fields: [],
      isEmbedded: false,
      dbName: null,
      idFields: [],
    },
    {
      name: 'Bike',
      fields: [],
      isEmbedded: false,
      dbName: null,
      idFields: [],
    },
    {
      name: 'Post',
      fields: [],
      isEmbedded: false,
      dbName: null,
      idFields: [],
    },
    {
      name: 'User',
      fields: [],
      isEmbedded: false,
      dbName: null,
      idFields: [],
    },
  ]

  expect(sortModels(models)).toMatchInlineSnapshot(`
    Array [
      Object {
        "dbName": null,
        "fields": Array [],
        "idFields": Array [],
        "isEmbedded": false,
        "name": "User",
      },
      Object {
        "dbName": null,
        "fields": Array [],
        "idFields": Array [],
        "isEmbedded": false,
        "name": "Post",
      },
      Object {
        "dbName": null,
        "fields": Array [],
        "idFields": Array [],
        "isEmbedded": false,
        "name": "Bike",
      },
      Object {
        "dbName": null,
        "fields": Array [],
        "idFields": Array [],
        "isEmbedded": false,
        "name": "Car",
      },
    ]
  `)
})
