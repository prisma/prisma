import { sortModels } from '../sortModels'
import { DMMF } from '@prisma/generator-helper'

test('sortModels', () => {
  const models: DMMF.Model[] = [
    {
      name: 'Car',
      fields: [],
      uniqueFields: [],
      isEmbedded: false,
      dbName: null,
      idFields: [],
    },
    {
      name: 'Bike',
      fields: [],
      uniqueFields: [],
      isEmbedded: false,
      dbName: null,
      idFields: [],
    },
    {
      name: 'Post',
      fields: [],
      uniqueFields: [],
      isEmbedded: false,
      dbName: null,
      idFields: [],
    },
    {
      name: 'User',
      uniqueFields: [],
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
        "uniqueFields": Array [],
      },
      Object {
        "dbName": null,
        "fields": Array [],
        "idFields": Array [],
        "isEmbedded": false,
        "name": "Post",
        "uniqueFields": Array [],
      },
      Object {
        "dbName": null,
        "fields": Array [],
        "idFields": Array [],
        "isEmbedded": false,
        "name": "Bike",
        "uniqueFields": Array [],
      },
      Object {
        "dbName": null,
        "fields": Array [],
        "idFields": Array [],
        "isEmbedded": false,
        "name": "Car",
        "uniqueFields": Array [],
      },
    ]
  `)
})
