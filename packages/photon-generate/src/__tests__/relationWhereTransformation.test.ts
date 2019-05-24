import chalk from 'chalk'
import { chinook } from '../fixtures/chinook'
import { DMMFClass, makeDocument, transformDocument } from '../runtime'
import { getDMMF } from '../utils/getDMMF'
chalk.enabled = false

describe('relation where transformation', () => {
  const dmmf = new DMMFClass(getDMMF(chinook))
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
      rootField: 'artists',
    })
    expect(String(document)).toMatchInlineSnapshot(`
            "query {
              artists(where: {
                Albums: {
                  some: {
                    Tracks: {
                      some: {
                        AND: [
                          {
                            UnitPrice: 5
                            Playlists: {
                              some: {
                                Tracks: {
                                  some: {
                                    Name: \\"\\"
                                    Genre: {
                                      id: 5
                                    }
                                  }
                                }
                              }
                            }
                          }
                        ]
                      }
                    }
                  }
                }
              }) {
                id
                Name
              }
            }"
        `)
    expect(String(transformDocument(document))).toMatchInlineSnapshot(`
            "query {
              artists(where: {
                Albums_some: {
                  Tracks_some: {
                    AND: [
                      {
                        UnitPrice: 5
                        Playlists_some_Tracks: {
                          some: {
                            Name: \\"\\"
                            Genre: {
                              id: 5
                            }
                          }
                        }
                      }
                    ]
                  }
                }
              }) {
                id
                Name
              }
            }"
        `)
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
      rootField: 'artists',
    })
    expect(() => document.validate(select)).toThrowErrorMatchingInlineSnapshot(`
"

Invalid \`photon.artists()\` invocation:

{
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
                        id: '5'
                            ~~~
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

Argument id: Got invalid value '5' on photon.artists. Provided String, expected Int or IntFilter.
type IntFilter {
  equals?: Int
  not?: Int | IntFilter
  in?: List<Int>
  notIn?: List<Int>
  lt?: Int
  lte?: Int
  gt?: Int
  gte?: Int
}

"
`)
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
      rootField: 'artists',
    })
    expect(() => document.validate(select)).toThrowErrorMatchingInlineSnapshot(`
"

Invalid \`photon.artists()\` invocation:

{
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
+                       id?: Int | IntFilter,
+                       Name?: String | NullableStringFilter | null,
+                       Tracks?: TrackFilter,
+                       AND?: GenreWhereInput,
+                       OR?: GenreWhereInput,
+                       NOT?: GenreWhereInput
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

Argument where.Albums.some.Tracks.some.AND.0.Playlists.some.Tracks.some.Genre of type GenreWhereInput needs at least one argument. Available args are listed in green.

"
`)
  })
})
