import { sortModels } from '../sortModels'
import { DMMF } from '@prisma/photon/dist/runtime/dmmf-types'

test('sortModels', () => {
  const models: DMMF.Model[] = [
    {
      name: 'Car',
      fields: [],
      isEmbedded: false,
      dbName: null,
    },
    {
      name: 'Bike',
      fields: [],
      isEmbedded: false,
      dbName: null,
    },
    {
      name: 'Post',
      fields: [],
      isEmbedded: false,
      dbName: null,
    },
    {
      name: 'User',
      fields: [],
      isEmbedded: false,
      dbName: null,
    },
  ]

  expect(sortModels(models)).toMatchInlineSnapshot(`
    Array [
      Object {
        "dbName": null,
        "fields": Array [],
        "isEmbedded": false,
        "name": "User",
      },
      Object {
        "dbName": null,
        "fields": Array [],
        "isEmbedded": false,
        "name": "Post",
      },
      Object {
        "dbName": null,
        "fields": Array [],
        "isEmbedded": false,
        "name": "Bike",
      },
      Object {
        "dbName": null,
        "fields": Array [],
        "isEmbedded": false,
        "name": "Car",
      },
    ]
  `)
})
