import vm from 'node:vm'

import type * as DMMF from '@prisma/dmmf'
import { describe, expect, test, vi } from 'vitest'

import { buildExactDescriptorMatcherRegistry } from '../src/utils/buildExactDescriptorMatcherRegistry'

const datamodel = {
  models: [
    {
      name: 'Post',
      fields: [{ name: 'id', kind: 'scalar', isList: false, isId: true, isUnique: false, type: 'Int' }],
    },
    {
      name: 'User',
      fields: [
        { name: 'id', kind: 'scalar', isList: false, isId: true, isUnique: false, type: 'Int' },
        { name: 'email', kind: 'scalar', isList: false, isId: false, isUnique: false, type: 'String' },
      ],
    },
  ],
} as unknown as DMMF.Datamodel

describe('buildExactDescriptorMatcherRegistry', () => {
  test('emits a descriptor-bound blog page template matcher with flat fallback', () => {
    const { registry, flatGetMatcher } = createRegistry([
      'template:Post.findUnique:id:blogPagePostV1',
      'User.findUnique:id:id,email',
    ])

    const matcher = registry.getMatcher({
      model: 'Post',
      action: 'findUnique',
      clientMethod: 'post.findUnique',
      descriptor: blogPageDescriptor('full'),
    })

    expect(matcher?.(blogPageArgs('full', 123))).toEqual({ '%1': 123 })
    expect(matcher?.(blogPageArgs('minimal', 123))).toBeUndefined()
    expect(matcher?.({ ...blogPageArgs('full', 123), extra: true })).toBeUndefined()
    expect(flatGetMatcher).not.toHaveBeenCalled()
  })

  test('binds the minimal blog page template shape independently', () => {
    const { registry } = createRegistry(['template:Post.findUnique:id:blogPagePostV1'])

    const matcher = registry.getMatcher({
      model: 'Post',
      action: 'findUnique',
      clientMethod: 'post.findUnique',
      descriptor: blogPageDescriptor('minimal'),
    })

    expect(matcher?.(blogPageArgs('minimal', 456))).toEqual({ '%1': 456 })
    expect(matcher?.(blogPageArgs('full', 456))).toBeUndefined()
  })

  test('falls back to the flat registry when the template does not bind', () => {
    const { registry, flatMatcher } = createRegistry(['template:Post.findUnique:id:blogPagePostV1'])

    const matcher = registry.getMatcher({
      model: 'Post',
      action: 'findUnique',
      clientMethod: 'post.findUnique',
      descriptor: { root: objectDescriptor(['where'], { where: objectDescriptor(['id'], { id: placeholder('%1') }) }) },
    })

    expect(matcher).toBe(flatMatcher)
  })
})

function createRegistry(configValue: string[]) {
  const code = buildExactDescriptorMatcherRegistry(datamodel, configValue, '__factory')
  const config: any = {}
  const flatMatcher = vi.fn()
  const flatGetMatcher = vi.fn(() => flatMatcher)
  const factory = vi.fn(() => ({ getMatcher: flatGetMatcher }))

  vm.runInNewContext(code, { __factory: factory, config })

  return { registry: config.descriptorMatcherRegistry, flatGetMatcher, flatMatcher }
}

function blogPageDescriptor(shape: 'full' | 'minimal') {
  return {
    root: objectDescriptor(['where', 'select'], {
      where: objectDescriptor(['id'], { id: placeholder('%1') }),
      select: blogPageSelectDescriptor(shape),
    }),
  }
}

function blogPageSelectDescriptor(shape: 'full' | 'minimal') {
  const scalarFields =
    shape === 'full'
      ? {
          id: constant(true),
          title: constant(true),
          slug: constant(true),
          content: constant(true),
          published: constant(true),
          viewCount: constant(true),
          createdAt: constant(true),
        }
      : {
          id: constant(true),
          title: constant(true),
        }

  return objectDescriptor(shape === 'full' ? BLOG_PAGE_ROOT_SELECT_KEYS : BLOG_PAGE_MINIMAL_ROOT_SELECT_KEYS, {
    ...scalarFields,
    author: selectionWrapperDescriptor(BLOG_PAGE_USER_SELECT_KEYS),
    category: selectionWrapperDescriptor(BLOG_PAGE_SLUG_SELECT_KEYS),
    tags: objectDescriptor(['select'], {
      select: objectDescriptor(['tag'], { tag: selectionWrapperDescriptor(BLOG_PAGE_SLUG_SELECT_KEYS) }),
    }),
    comments: objectDescriptor(['take', 'orderBy', 'select'], {
      take: constant(10),
      orderBy: { kind: 'array', items: [objectDescriptor(['createdAt'], { createdAt: constant('desc') })] },
      select: objectDescriptor(BLOG_PAGE_COMMENT_SELECT_KEYS, {
        id: constant(true),
        content: constant(true),
        createdAt: constant(true),
        author: selectionWrapperDescriptor(BLOG_PAGE_USER_SELECT_KEYS),
      }),
    }),
    _count: selectionWrapperDescriptor(BLOG_PAGE_COUNT_SELECT_KEYS),
  })
}

function blogPageArgs(shape: 'full' | 'minimal', id: number) {
  const scalarFields =
    shape === 'full'
      ? {
          id: true,
          title: true,
          slug: true,
          content: true,
          published: true,
          viewCount: true,
          createdAt: true,
        }
      : {
          id: true,
          title: true,
        }

  return {
    where: { id },
    select: {
      ...scalarFields,
      author: selectionWrapper(BLOG_PAGE_USER_SELECT_KEYS),
      category: selectionWrapper(BLOG_PAGE_SLUG_SELECT_KEYS),
      tags: { select: { tag: selectionWrapper(BLOG_PAGE_SLUG_SELECT_KEYS) } },
      comments: {
        take: 10,
        orderBy: [{ createdAt: 'desc' }],
        select: {
          id: true,
          content: true,
          createdAt: true,
          author: selectionWrapper(BLOG_PAGE_USER_SELECT_KEYS),
        },
      },
      _count: selectionWrapper(BLOG_PAGE_COUNT_SELECT_KEYS),
    },
  }
}

function selectionWrapper(keys: readonly string[]) {
  return { select: Object.fromEntries(keys.map((key) => [key, true])) }
}

function selectionWrapperDescriptor(keys: readonly string[]) {
  return objectDescriptor(['select'], {
    select: objectDescriptor(keys, Object.fromEntries(keys.map((key) => [key, constant(true)]))),
  })
}

function objectDescriptor(keys: readonly string[], fields: Record<string, unknown>) {
  return { kind: 'object', keys: [...keys], fields }
}

function placeholder(name: string) {
  return { kind: 'placeholder', name, valueType: 'number' }
}

function constant(value: unknown) {
  return { kind: 'constant', value }
}

const BLOG_PAGE_ROOT_SELECT_KEYS = [
  'id',
  'title',
  'slug',
  'content',
  'published',
  'viewCount',
  'createdAt',
  'author',
  'category',
  'tags',
  'comments',
  '_count',
]
const BLOG_PAGE_MINIMAL_ROOT_SELECT_KEYS = ['id', 'title', 'author', 'category', 'tags', 'comments', '_count']
const BLOG_PAGE_USER_SELECT_KEYS = ['id', 'name', 'avatar']
const BLOG_PAGE_SLUG_SELECT_KEYS = ['id', 'name', 'slug']
const BLOG_PAGE_COUNT_SELECT_KEYS = ['likes', 'comments']
const BLOG_PAGE_COMMENT_SELECT_KEYS = ['id', 'content', 'createdAt', 'author']
