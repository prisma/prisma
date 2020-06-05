import { sortModels } from '../sortModels'
import { DMMF } from '@prisma/generator-helper'

test('sortModels', () => {
  const models: DMMF.Model[] = [
    {
      name: 'Car',
      fields: [],
      uniqueFields: [],
      uniqueIndexes: [],
      isEmbedded: false,
      dbName: null,
      idFields: [],
    },
    {
      name: 'Bike',
      fields: [],
      uniqueFields: [],
      uniqueIndexes: [],
      isEmbedded: false,
      dbName: null,
      idFields: [],
    },
    {
      name: 'Post',
      fields: [],
      uniqueFields: [],
      uniqueIndexes: [],
      isEmbedded: false,
      dbName: null,
      idFields: [],
    },
    {
      name: 'User',
      uniqueFields: [],
      uniqueIndexes: [],
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
        "uniqueIndexes": Array [],
      },
      Object {
        "dbName": null,
        "fields": Array [],
        "idFields": Array [],
        "isEmbedded": false,
        "name": "Post",
        "uniqueFields": Array [],
        "uniqueIndexes": Array [],
      },
      Object {
        "dbName": null,
        "fields": Array [],
        "idFields": Array [],
        "isEmbedded": false,
        "name": "Bike",
        "uniqueFields": Array [],
        "uniqueIndexes": Array [],
      },
      Object {
        "dbName": null,
        "fields": Array [],
        "idFields": Array [],
        "isEmbedded": false,
        "name": "Car",
        "uniqueFields": Array [],
        "uniqueIndexes": Array [],
      },
    ]
  `)
})
