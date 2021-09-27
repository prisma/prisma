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
      primaryKey: null,
      isGenerated: false,
    },
    {
      name: 'Bike',
      fields: [],
      uniqueFields: [],
      uniqueIndexes: [],
      isEmbedded: false,
      dbName: null,
      primaryKey: null,
      isGenerated: false,
    },
    {
      name: 'Post',
      fields: [],
      uniqueFields: [],
      uniqueIndexes: [],
      isEmbedded: false,
      dbName: null,
      primaryKey: null,
      isGenerated: false,
    },
    {
      name: 'User',
      uniqueFields: [],
      uniqueIndexes: [],
      fields: [],
      isEmbedded: false,
      dbName: null,
      primaryKey: null,
      isGenerated: false,
    },
  ]

  expect(sortModels(models)).toMatchSnapshot()
})
