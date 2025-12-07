import { describe, expect, it } from 'vitest'

import { PARAM_PLACEHOLDER, parameterizeQuery } from '../parameterize'

describe('parameterizeQuery - relation filters', () => {
  describe('some operator', () => {
    it('handles some relation filter', () => {
      const query = {
        arguments: {
          where: {
            posts: { some: { title: 'Test' } },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            posts: { some: { title: PARAM_PLACEHOLDER } },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('handles some with complex nested conditions', () => {
      const query = {
        arguments: {
          where: {
            posts: {
              some: {
                AND: [{ title: { contains: 'Prisma' } }, { published: true }],
              },
            },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            posts: {
              some: {
                AND: [{ title: { contains: PARAM_PLACEHOLDER } }, { published: PARAM_PLACEHOLDER }],
              },
            },
          },
        },
        selection: { $scalars: true },
      })
    })
  })

  describe('every operator', () => {
    it('handles every relation filter', () => {
      const query = {
        arguments: {
          where: {
            posts: { every: { published: true } },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            posts: { every: { published: PARAM_PLACEHOLDER } },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('handles every with multiple conditions', () => {
      const query = {
        arguments: {
          where: {
            comments: {
              every: {
                approved: true,
                spam: false,
              },
            },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            comments: {
              every: {
                approved: PARAM_PLACEHOLDER,
                spam: PARAM_PLACEHOLDER,
              },
            },
          },
        },
        selection: { $scalars: true },
      })
    })
  })

  describe('none operator', () => {
    it('handles none relation filter', () => {
      const query = {
        arguments: {
          where: {
            posts: { none: { deleted: true } },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            posts: { none: { deleted: PARAM_PLACEHOLDER } },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('handles none with filter operators', () => {
      const query = {
        arguments: {
          where: {
            users: {
              none: {
                email: { endsWith: '@blocked.com' },
              },
            },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            users: {
              none: {
                email: { endsWith: PARAM_PLACEHOLDER },
              },
            },
          },
        },
        selection: { $scalars: true },
      })
    })
  })

  describe('nested relation filters', () => {
    it('handles deeply nested relation filters', () => {
      const query = {
        arguments: {
          where: {
            author: {
              posts: {
                some: {
                  comments: {
                    every: {
                      approved: true,
                    },
                  },
                },
              },
            },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            author: {
              posts: {
                some: {
                  comments: {
                    every: {
                      approved: PARAM_PLACEHOLDER,
                    },
                  },
                },
              },
            },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('handles multiple relation filters at same level', () => {
      const query = {
        arguments: {
          where: {
            posts: { some: { published: true } },
            comments: { none: { spam: true } },
            followers: { every: { active: true } },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            posts: { some: { published: PARAM_PLACEHOLDER } },
            comments: { none: { spam: PARAM_PLACEHOLDER } },
            followers: { every: { active: PARAM_PLACEHOLDER } },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('handles relation filters combined with field filters', () => {
      const query = {
        arguments: {
          where: {
            email: { contains: '@company.com' },
            posts: {
              some: {
                title: { startsWith: 'Announcement' },
                views: { gt: 100 },
              },
            },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            email: { contains: PARAM_PLACEHOLDER },
            posts: {
              some: {
                title: { startsWith: PARAM_PLACEHOLDER },
                views: { gt: PARAM_PLACEHOLDER },
              },
            },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('handles relation filters inside logical operators', () => {
      const query = {
        arguments: {
          where: {
            OR: [{ posts: { some: { featured: true } } }, { role: 'ADMIN' }],
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            OR: [{ posts: { some: { featured: PARAM_PLACEHOLDER } } }, { role: PARAM_PLACEHOLDER }],
          },
        },
        selection: { $scalars: true },
      })
    })
  })
})
