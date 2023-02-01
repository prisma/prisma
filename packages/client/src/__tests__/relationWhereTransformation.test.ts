import { getDMMF } from '@prisma/internals'
import chalk from 'chalk'

import { chinook } from '../fixtures/chinook'
import { DMMFClass, makeDocument } from '../runtime'
import { MergedExtensionsList } from '../runtime/core/extensions/MergedExtensionsList'

chalk.level = 0

describe('relation where transformation', () => {
  let dmmf
  beforeAll(async () => {
    dmmf = new DMMFClass(await getDMMF({ datamodel: chinook }))
  })

  test('transform correctly', () => {
    const select = {
      where: {
        Albums: {
          some: {
            Tracks: {
              some: {
                AND: {
                  UnitPrice: 5,
                  Playlists: {
                    some: {
                      Tracks: {
                        some: {
                          Name: '',
                          Genre: {
                            id: 5,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }
    const document = makeDocument({
      dmmf,
      select,
      rootTypeName: 'query',
      rootField: 'findManyArtist',
      extensions: MergedExtensionsList.empty(),
    })

    expect(() => document.validate(select, false, 'users')).toThrowErrorMatchingSnapshot()
  })

  test('throw correctly for incorrect deep scalar', () => {
    const select = {
      where: {
        Albums: {
          some: {
            Tracks: {
              some: {
                AND: {
                  UnitPrice: 5,
                  Playlists: {
                    some: {
                      Tracks: {
                        some: {
                          Name: '',
                          Genre: {
                            id: '5',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }
    const document = makeDocument({
      dmmf,
      select,
      rootTypeName: 'query',
      rootField: 'findManyArtist',
      extensions: MergedExtensionsList.empty(),
    })
    expect(() => document.validate(select, false, 'users')).toThrowErrorMatchingSnapshot()
  })
  test('throw correctly for deep at least one error', () => {
    const select = {
      where: {
        Albums: {
          some: {
            Tracks: {
              some: {
                AND: {
                  UnitPrice: 5,
                  Playlists: {
                    some: {
                      Tracks: {
                        some: {
                          Name: '',
                          Genre: {},
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }
    const document = makeDocument({
      dmmf,
      select,
      rootTypeName: 'query',
      rootField: 'findManyArtist',
      extensions: MergedExtensionsList.empty(),
    })
    expect(() => document.validate(select, false, 'artists')).toThrowErrorMatchingSnapshot()
  })
})
