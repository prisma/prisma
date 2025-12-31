import { describe, expect, it } from 'vitest'

import { PARAM_PLACEHOLDER, parameterizeQuery } from '../parameterize'

describe('parameterizeQuery - data context (create/update)', () => {
  describe('basic data operations', () => {
    it('parameterizes all values in data object', () => {
      const query = {
        arguments: {
          data: {
            email: 'new@example.com',
            name: 'New User',
            age: 25,
            isActive: true,
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          data: {
            email: PARAM_PLACEHOLDER,
            name: PARAM_PLACEHOLDER,
            age: PARAM_PLACEHOLDER,
            isActive: PARAM_PLACEHOLDER,
          },
        },
        selection: { $scalars: true },
      })
    })

    it('preserves null in data object', () => {
      const query = {
        arguments: {
          data: {
            deletedAt: null,
            name: 'Test',
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          data: {
            deletedAt: null,
            name: PARAM_PLACEHOLDER,
          },
        },
        selection: { $scalars: true },
      })
    })
  })

  describe('nested relation creates', () => {
    it('handles create in data', () => {
      const query = {
        arguments: {
          data: {
            email: 'user@example.com',
            posts: {
              create: {
                title: 'My Post',
                content: 'Content here',
              },
            },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          data: {
            email: PARAM_PLACEHOLDER,
            posts: {
              create: {
                title: PARAM_PLACEHOLDER,
                content: PARAM_PLACEHOLDER,
              },
            },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('handles create with array of records', () => {
      const query = {
        arguments: {
          data: {
            email: 'user@example.com',
            posts: {
              create: [
                { title: 'Post 1', content: 'Content 1' },
                { title: 'Post 2', content: 'Content 2' },
              ],
            },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          data: {
            email: PARAM_PLACEHOLDER,
            posts: {
              create: [
                { title: PARAM_PLACEHOLDER, content: PARAM_PLACEHOLDER },
                { title: PARAM_PLACEHOLDER, content: PARAM_PLACEHOLDER },
              ],
            },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('handles createMany in data', () => {
      const query = {
        arguments: {
          data: {
            email: 'user@example.com',
            posts: {
              createMany: {
                data: [
                  { title: 'Post 1', content: 'Content 1' },
                  { title: 'Post 2', content: 'Content 2' },
                ],
              },
            },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          data: {
            email: PARAM_PLACEHOLDER,
            posts: {
              createMany: {
                data: [
                  { title: PARAM_PLACEHOLDER, content: PARAM_PLACEHOLDER },
                  { title: PARAM_PLACEHOLDER, content: PARAM_PLACEHOLDER },
                ],
              },
            },
          },
        },
        selection: { $scalars: true },
      })
    })
  })

  describe('connect operations', () => {
    it('handles connect in data', () => {
      const query = {
        arguments: {
          data: {
            email: 'user@example.com',
            profile: {
              connect: {
                id: 123,
              },
            },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          data: {
            email: PARAM_PLACEHOLDER,
            profile: {
              connect: {
                id: PARAM_PLACEHOLDER,
              },
            },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('handles connect with array', () => {
      const query = {
        arguments: {
          data: {
            tags: {
              connect: [{ id: 1 }, { id: 2 }, { id: 3 }],
            },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          data: {
            tags: {
              connect: [{ id: PARAM_PLACEHOLDER }, { id: PARAM_PLACEHOLDER }, { id: PARAM_PLACEHOLDER }],
            },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('handles connectOrCreate in data', () => {
      const query = {
        arguments: {
          data: {
            email: 'user@example.com',
            profile: {
              connectOrCreate: {
                where: { userId: 123 },
                create: { bio: 'New bio' },
              },
            },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          data: {
            email: PARAM_PLACEHOLDER,
            profile: {
              connectOrCreate: {
                where: { userId: PARAM_PLACEHOLDER },
                create: { bio: PARAM_PLACEHOLDER },
              },
            },
          },
        },
        selection: { $scalars: true },
      })
    })
  })

  describe('disconnect operations', () => {
    it('handles disconnect with array', () => {
      const query = {
        arguments: {
          data: {
            posts: {
              disconnect: [{ id: 1 }, { id: 2 }],
            },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          data: {
            posts: {
              disconnect: [{ id: PARAM_PLACEHOLDER }, { id: PARAM_PLACEHOLDER }],
            },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('handles disconnect with boolean', () => {
      const query = {
        arguments: {
          data: {
            profile: {
              disconnect: true,
            },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          data: {
            profile: {
              disconnect: PARAM_PLACEHOLDER,
            },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('handles disconnect with where clause', () => {
      const query = {
        arguments: {
          data: {
            tags: {
              disconnect: { id: 123 },
            },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          data: {
            tags: {
              disconnect: { id: PARAM_PLACEHOLDER },
            },
          },
        },
        selection: { $scalars: true },
      })
    })
  })

  describe('set operations', () => {
    it('handles set with array of values', () => {
      const query = {
        arguments: {
          data: {
            tags: {
              set: ['tag1', 'tag2'],
            },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          data: {
            tags: {
              set: [PARAM_PLACEHOLDER, PARAM_PLACEHOLDER],
            },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('handles set with array of objects', () => {
      const query = {
        arguments: {
          data: {
            categories: {
              set: [{ id: 1 }, { id: 2 }],
            },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          data: {
            categories: {
              set: [{ id: PARAM_PLACEHOLDER }, { id: PARAM_PLACEHOLDER }],
            },
          },
        },
        selection: { $scalars: true },
      })
    })
  })

  describe('update operations', () => {
    it('handles update in nested data', () => {
      const query = {
        arguments: {
          data: {
            profile: {
              update: {
                bio: 'Updated bio',
              },
            },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          data: {
            profile: {
              update: {
                bio: PARAM_PLACEHOLDER,
              },
            },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('handles update with where clause', () => {
      const query = {
        arguments: {
          data: {
            posts: {
              update: {
                where: { id: 123 },
                data: { title: 'Updated title' },
              },
            },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          data: {
            posts: {
              update: {
                where: { id: PARAM_PLACEHOLDER },
                data: { title: PARAM_PLACEHOLDER },
              },
            },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('handles updateMany in nested data', () => {
      const query = {
        arguments: {
          data: {
            posts: {
              updateMany: {
                where: { published: false },
                data: { draft: true },
              },
            },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          data: {
            posts: {
              updateMany: {
                where: { published: PARAM_PLACEHOLDER },
                data: { draft: PARAM_PLACEHOLDER },
              },
            },
          },
        },
        selection: { $scalars: true },
      })
    })
  })

  describe('upsert operations', () => {
    it('handles upsert in nested data', () => {
      const query = {
        arguments: {
          data: {
            profile: {
              upsert: {
                create: { bio: 'New bio' },
                update: { bio: 'Updated bio' },
              },
            },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          data: {
            profile: {
              upsert: {
                create: { bio: PARAM_PLACEHOLDER },
                update: { bio: PARAM_PLACEHOLDER },
              },
            },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('handles upsert with where clause', () => {
      const query = {
        arguments: {
          data: {
            posts: {
              upsert: {
                where: { slug: 'my-post' },
                create: { title: 'New Post', slug: 'my-post' },
                update: { title: 'Updated Post' },
              },
            },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          data: {
            posts: {
              upsert: {
                where: { slug: PARAM_PLACEHOLDER },
                create: { title: PARAM_PLACEHOLDER, slug: PARAM_PLACEHOLDER },
                update: { title: PARAM_PLACEHOLDER },
              },
            },
          },
        },
        selection: { $scalars: true },
      })
    })
  })

  describe('delete operations', () => {
    it('handles delete in nested data', () => {
      const query = {
        arguments: {
          data: {
            posts: {
              delete: { id: 123 },
            },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          data: {
            posts: {
              delete: { id: PARAM_PLACEHOLDER },
            },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('handles delete with array', () => {
      const query = {
        arguments: {
          data: {
            posts: {
              delete: [{ id: 1 }, { id: 2 }],
            },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          data: {
            posts: {
              delete: [{ id: PARAM_PLACEHOLDER }, { id: PARAM_PLACEHOLDER }],
            },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('handles delete with boolean', () => {
      const query = {
        arguments: {
          data: {
            profile: {
              delete: true,
            },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          data: {
            profile: {
              delete: PARAM_PLACEHOLDER,
            },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('handles deleteMany in nested data', () => {
      const query = {
        arguments: {
          data: {
            posts: {
              deleteMany: {
                where: { published: false },
              },
            },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          data: {
            posts: {
              deleteMany: {
                where: { published: PARAM_PLACEHOLDER },
              },
            },
          },
        },
        selection: { $scalars: true },
      })
    })
  })

  describe('complex nested data operations', () => {
    it('handles multiple nested operations together', () => {
      const query = {
        arguments: {
          data: {
            email: 'user@example.com',
            profile: {
              create: { bio: 'New user' },
            },
            posts: {
              create: [{ title: 'Post 1' }],
              connect: [{ id: 100 }],
            },
            tags: {
              set: [{ id: 1 }, { id: 2 }],
            },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          data: {
            email: PARAM_PLACEHOLDER,
            profile: {
              create: { bio: PARAM_PLACEHOLDER },
            },
            posts: {
              create: [{ title: PARAM_PLACEHOLDER }],
              connect: [{ id: PARAM_PLACEHOLDER }],
            },
            tags: {
              set: [{ id: PARAM_PLACEHOLDER }, { id: PARAM_PLACEHOLDER }],
            },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('handles deeply nested relation creates', () => {
      const query = {
        arguments: {
          data: {
            email: 'user@example.com',
            posts: {
              create: {
                title: 'My Post',
                comments: {
                  create: {
                    content: 'First comment',
                    author: {
                      connect: { id: 456 },
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
          data: {
            email: PARAM_PLACEHOLDER,
            posts: {
              create: {
                title: PARAM_PLACEHOLDER,
                comments: {
                  create: {
                    content: PARAM_PLACEHOLDER,
                    author: {
                      connect: { id: PARAM_PLACEHOLDER },
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
  })
})
