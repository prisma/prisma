import { describe, expect, it } from 'vitest'

import { PARAM_PLACEHOLDER, parameterizeQuery } from '../parameterize'

describe('parameterizeQuery - complex nested queries', () => {
  it('handles deeply nested structure with all features', () => {
    const query = {
      arguments: {
        where: {
          AND: [
            { email: { contains: '@company.com' } },
            {
              OR: [{ role: 'ADMIN' }, { permissions: { some: { name: 'WRITE' } } }],
            },
          ],
        },
        take: 10,
        skip: 0,
      },
      selection: {
        $scalars: true,
        posts: {
          arguments: {
            where: { published: true },
            orderBy: { createdAt: { sort: 'desc' } },
          },
          selection: { $scalars: true },
        },
      },
    }

    expect(parameterizeQuery(query)).toEqual({
      arguments: {
        where: {
          AND: [
            { email: { contains: PARAM_PLACEHOLDER } },
            {
              OR: [{ role: PARAM_PLACEHOLDER }, { permissions: { some: { name: PARAM_PLACEHOLDER } } }],
            },
          ],
        },
        take: 10,
        skip: 0,
      },
      selection: {
        $scalars: true,
        posts: {
          arguments: {
            where: { published: PARAM_PLACEHOLDER },
            orderBy: { createdAt: { sort: 'desc' } },
          },
          selection: { $scalars: true },
        },
      },
    })
  })

  it('handles query with multiple nested selections and filters', () => {
    const query = {
      arguments: {
        where: {
          id: 1,
          isActive: true,
        },
      },
      selection: {
        $scalars: true,
        profile: {
          selection: {
            $scalars: true,
            avatar: {
              selection: { $scalars: true },
            },
          },
        },
        posts: {
          arguments: {
            where: {
              OR: [{ published: true }, { authorId: 1 }],
            },
            take: 5,
            orderBy: { createdAt: { sort: 'desc' } },
          },
          selection: {
            $scalars: true,
            comments: {
              arguments: {
                where: { approved: true },
                take: 10,
              },
              selection: {
                $scalars: true,
                author: {
                  selection: { $scalars: true },
                },
              },
            },
          },
        },
      },
    }

    expect(parameterizeQuery(query)).toEqual({
      arguments: {
        where: {
          id: PARAM_PLACEHOLDER,
          isActive: PARAM_PLACEHOLDER,
        },
      },
      selection: {
        $scalars: true,
        profile: {
          selection: {
            $scalars: true,
            avatar: {
              selection: { $scalars: true },
            },
          },
        },
        posts: {
          arguments: {
            where: {
              OR: [{ published: PARAM_PLACEHOLDER }, { authorId: PARAM_PLACEHOLDER }],
            },
            take: 5,
            orderBy: { createdAt: { sort: 'desc' } },
          },
          selection: {
            $scalars: true,
            comments: {
              arguments: {
                where: { approved: PARAM_PLACEHOLDER },
                take: 10,
              },
              selection: {
                $scalars: true,
                author: {
                  selection: { $scalars: true },
                },
              },
            },
          },
        },
      },
    })
  })

  it('handles create with nested relations and where conditions', () => {
    const query = {
      arguments: {
        data: {
          email: 'user@example.com',
          name: 'Test User',
          profile: {
            create: {
              bio: 'Hello world',
              settings: {
                create: {
                  theme: 'dark',
                  notifications: true,
                },
              },
            },
          },
          posts: {
            create: [
              {
                title: 'First Post',
                content: 'Content here',
                tags: {
                  connect: [{ id: 1 }, { id: 2 }],
                },
              },
            ],
          },
        },
      },
      selection: {
        $scalars: true,
        profile: {
          selection: { $scalars: true },
        },
        posts: {
          selection: {
            $scalars: true,
            tags: {
              selection: { $scalars: true },
            },
          },
        },
      },
    }

    expect(parameterizeQuery(query)).toEqual({
      arguments: {
        data: {
          email: PARAM_PLACEHOLDER,
          name: PARAM_PLACEHOLDER,
          profile: {
            create: {
              bio: PARAM_PLACEHOLDER,
              settings: {
                create: {
                  theme: PARAM_PLACEHOLDER,
                  notifications: PARAM_PLACEHOLDER,
                },
              },
            },
          },
          posts: {
            create: [
              {
                title: PARAM_PLACEHOLDER,
                content: PARAM_PLACEHOLDER,
                tags: {
                  connect: [{ id: PARAM_PLACEHOLDER }, { id: PARAM_PLACEHOLDER }],
                },
              },
            ],
          },
        },
      },
      selection: {
        $scalars: true,
        profile: {
          selection: { $scalars: true },
        },
        posts: {
          selection: {
            $scalars: true,
            tags: {
              selection: { $scalars: true },
            },
          },
        },
      },
    })
  })

  it('handles update with complex nested operations', () => {
    const query = {
      arguments: {
        where: { id: 1 },
        data: {
          email: 'updated@example.com',
          profile: {
            update: {
              bio: 'Updated bio',
            },
          },
          posts: {
            create: { title: 'New Post' },
            update: {
              where: { id: 100 },
              data: { title: 'Updated Title' },
            },
            deleteMany: {
              where: { published: false },
            },
          },
          tags: {
            set: [{ id: 1 }, { id: 2 }],
            disconnect: [{ id: 3 }],
          },
        },
      },
      selection: { $scalars: true },
    }

    expect(parameterizeQuery(query)).toEqual({
      arguments: {
        where: { id: PARAM_PLACEHOLDER },
        data: {
          email: PARAM_PLACEHOLDER,
          profile: {
            update: {
              bio: PARAM_PLACEHOLDER,
            },
          },
          posts: {
            create: { title: PARAM_PLACEHOLDER },
            update: {
              where: { id: PARAM_PLACEHOLDER },
              data: { title: PARAM_PLACEHOLDER },
            },
            deleteMany: {
              where: { published: PARAM_PLACEHOLDER },
            },
          },
          tags: {
            set: [{ id: PARAM_PLACEHOLDER }, { id: PARAM_PLACEHOLDER }],
            disconnect: [{ id: PARAM_PLACEHOLDER }],
          },
        },
      },
      selection: { $scalars: true },
    })
  })

  it('handles query with aggregations in selection', () => {
    const query = {
      arguments: {
        where: { status: 'ACTIVE' },
      },
      selection: {
        $scalars: true,
        _count: {
          selection: {
            posts: true,
            comments: true,
          },
        },
        posts: {
          arguments: {
            where: { published: true },
          },
          selection: {
            $scalars: true,
            _count: {
              selection: {
                comments: true,
                likes: true,
              },
            },
          },
        },
      },
    }

    expect(parameterizeQuery(query)).toEqual({
      arguments: {
        where: { status: PARAM_PLACEHOLDER },
      },
      selection: {
        $scalars: true,
        _count: {
          selection: {
            posts: true,
            comments: true,
          },
        },
        posts: {
          arguments: {
            where: { published: PARAM_PLACEHOLDER },
          },
          selection: {
            $scalars: true,
            _count: {
              selection: {
                comments: true,
                likes: true,
              },
            },
          },
        },
      },
    })
  })

  it('handles upsert with complex where and data', () => {
    const query = {
      arguments: {
        where: {
          email_tenantId: {
            email: 'user@example.com',
            tenantId: 'tenant-123',
          },
        },
        create: {
          email: 'user@example.com',
          tenantId: 'tenant-123',
          name: 'New User',
          profile: {
            create: { bio: 'New profile' },
          },
        },
        update: {
          name: 'Updated User',
          profile: {
            upsert: {
              create: { bio: 'Created profile' },
              update: { bio: 'Updated profile' },
            },
          },
        },
      },
      selection: {
        $scalars: true,
        profile: {
          selection: { $scalars: true },
        },
      },
    }

    expect(parameterizeQuery(query)).toEqual({
      arguments: {
        where: {
          email_tenantId: {
            email: PARAM_PLACEHOLDER,
            tenantId: PARAM_PLACEHOLDER,
          },
        },
        create: {
          email: PARAM_PLACEHOLDER,
          tenantId: PARAM_PLACEHOLDER,
          name: PARAM_PLACEHOLDER,
          profile: {
            create: { bio: PARAM_PLACEHOLDER },
          },
        },
        update: {
          name: PARAM_PLACEHOLDER,
          profile: {
            upsert: {
              create: { bio: PARAM_PLACEHOLDER },
              update: { bio: PARAM_PLACEHOLDER },
            },
          },
        },
      },
      selection: {
        $scalars: true,
        profile: {
          selection: { $scalars: true },
        },
      },
    })
  })

  it('handles complex filter with multiple relation traversals', () => {
    const query = {
      arguments: {
        where: {
          AND: [
            {
              author: {
                profile: {
                  is: {
                    verified: true,
                  },
                },
              },
            },
            {
              categories: {
                some: {
                  parent: {
                    name: 'Technology',
                  },
                },
              },
            },
            {
              NOT: {
                tags: {
                  none: {
                    name: { in: ['spam', 'blocked'] },
                  },
                },
              },
            },
          ],
        },
        orderBy: [{ createdAt: { sort: 'desc' } }, { title: { sort: 'asc' } }],
        take: 20,
        skip: 0,
      },
      selection: {
        $scalars: true,
        author: {
          selection: {
            $scalars: true,
            profile: {
              selection: { $scalars: true },
            },
          },
        },
        categories: {
          selection: {
            $scalars: true,
            parent: {
              selection: { $scalars: true },
            },
          },
        },
        tags: {
          selection: { $scalars: true },
        },
      },
    }

    expect(parameterizeQuery(query)).toEqual({
      arguments: {
        where: {
          AND: [
            {
              author: {
                profile: {
                  is: {
                    verified: PARAM_PLACEHOLDER,
                  },
                },
              },
            },
            {
              categories: {
                some: {
                  parent: {
                    name: PARAM_PLACEHOLDER,
                  },
                },
              },
            },
            {
              NOT: {
                tags: {
                  none: {
                    name: { in: [PARAM_PLACEHOLDER, PARAM_PLACEHOLDER] },
                  },
                },
              },
            },
          ],
        },
        orderBy: [{ createdAt: { sort: 'desc' } }, { title: { sort: 'asc' } }],
        take: 20,
        skip: 0,
      },
      selection: {
        $scalars: true,
        author: {
          selection: {
            $scalars: true,
            profile: {
              selection: { $scalars: true },
            },
          },
        },
        categories: {
          selection: {
            $scalars: true,
            parent: {
              selection: { $scalars: true },
            },
          },
        },
        tags: {
          selection: { $scalars: true },
        },
      },
    })
  })
})
