import { readFileSync } from 'node:fs'
import vm from 'node:vm'

import { dmmfToRuntimeDataModel } from '@prisma/client-common'
import type * as DMMF from '@prisma/dmmf'
import internals from '@prisma/internals'
import { buildParamGraph } from '@prisma/param-graph-builder'
import { describe, expect, test, vi } from 'vitest'

import { serializeJsonQuery } from '../../client/src/runtime/core/jsonProtocol/serializeJsonQuery'
import { skip } from '../../client/src/runtime/core/types/exported/Skip'
import { parameterizeQuery } from '../../client-engine-runtime/src/parameterization/parameterize'
import { ParamGraph } from '../../param-graph/src'
import { buildExactDescriptorMatcherRegistry } from '../src/utils/buildExactDescriptorMatcherRegistry'

const datamodel = {
  enums: [
    {
      name: 'Status',
      values: [
        { name: 'ACTIVE', dbName: 'A' },
        { name: 'INACTIVE', dbName: null },
      ],
    },
  ],
  models: [
    {
      name: 'Post',
      fields: [
        { name: 'id', kind: 'scalar', isList: false, isId: true, isUnique: false, type: 'Int' },
        { name: 'slug', kind: 'scalar', isList: false, isId: false, isUnique: true, type: 'String' },
      ],
    },
    {
      name: 'User',
      fields: [
        { name: 'id', kind: 'scalar', isList: false, isId: true, isUnique: false, type: 'Int' },
        { name: 'email', kind: 'scalar', isList: false, isId: false, isUnique: false, type: 'String' },
        { name: 'status', kind: 'enum', isList: false, isId: false, isUnique: true, type: 'Status' },
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

  test('emits a descriptor-bound blog feed template matcher', () => {
    const { registry, flatGetMatcher } = createRegistry(['template:Post.findMany:take:blogFeedPostListV1'])

    const matcher = registry.getMatcher({
      model: 'Post',
      action: 'findMany',
      clientMethod: 'post.findMany',
      descriptor: blogFeedDescriptor(),
    })
    const args = blogFeedArgs(10)

    expect(matcher?.(args)).toEqual({})
    expect(matcher?.({ ...args, extra: true })).toBeUndefined()
    expect(matcher?.({ ...args, take: 11 })).toBeUndefined()
    expect(matcher?.({ ...args, take: 12.5 })).toBeUndefined()
    expect(matcher?.({ ...args, orderBy: [{ createdAt: 'asc' }] })).toBeUndefined()
    expect(matcher?.({ ...args, select: { ...args.select, slug: undefined } })).toBeUndefined()
    expect(flatGetMatcher).not.toHaveBeenCalled()
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

  test('emits enum exact descriptor specs with database value mappings', () => {
    const { factory } = createRegistry(['User.findUnique:status:id,status'])

    expect(factory).toHaveBeenCalledWith([
      {
        model: 'User',
        action: 'findUnique',
        clientMethod: 'user.findUnique',
        field: 'status',
        valueType: 'enum',
        enumValues: { ACTIVE: 'A', INACTIVE: 'INACTIVE' },
        select: ['id', 'status'],
      },
    ])
  })

  test('matches the serializer and parameterizer oracle for the blog page template', async () => {
    const oracle = await createBlogPageOracle()
    const { registry } = createRegistryFromDatamodel(oracle.datamodel, ['template:Post.findUnique:id:blogPagePostV1'])
    const firstArgs = blogPageArgs('full', 101)
    const nextArgs = blogPageArgs('full', 202)
    const first = oracle.fromArgs(firstArgs)
    const next = oracle.fromArgs(nextArgs)
    const matcher = registry.getMatcher({
      model: 'Post',
      action: 'findUnique',
      clientMethod: 'post.findUnique',
      descriptor: first.descriptor,
      precomputedQueryPlanCacheHit: {
        cacheKey: first.cacheKey,
        placeholderValues: first.placeholderValues,
      },
    })

    expect(matcher?.(nextArgs)).toEqual(next.placeholderValues)
    expect(Object.keys(matcher?.(nextArgs) ?? {})).toEqual(Object.keys(next.placeholderValues))
    expect(first.cacheKey).toBe(next.cacheKey)
    expect(matcher?.({ select: nextArgs.select, where: nextArgs.where })).toBeUndefined()
    expect(matcher?.({ ...nextArgs, extra: true })).toBeUndefined()
    expect(matcher?.({ where: { id: '202' }, select: nextArgs.select })).toBeUndefined()
    expect(matcher?.({ where: { id: 202.5 }, select: nextArgs.select })).toBeUndefined()
    expect(matcher?.({ where: nextArgs.where, select: { ...nextArgs.select, slug: undefined } })).toBeUndefined()
    expect(matcher?.({ where: nextArgs.where, select: { ...nextArgs.select, slug: skip } })).toBeUndefined()
    expect(
      matcher?.({
        where: nextArgs.where,
        select: { ...nextArgs.select, comments: { ...nextArgs.select.comments, take: 11 } },
      }),
    ).toBeUndefined()
  })

  test('matches the serializer and parameterizer oracle for the minimal blog page template', async () => {
    const oracle = await createBlogPageOracle()
    const { registry } = createRegistryFromDatamodel(oracle.datamodel, ['template:Post.findUnique:id:blogPagePostV1'])
    const firstArgs = blogPageArgs('minimal', 303)
    const nextArgs = blogPageArgs('minimal', 404)
    const first = oracle.fromArgs(firstArgs)
    const next = oracle.fromArgs(nextArgs)
    const matcher = registry.getMatcher({
      model: 'Post',
      action: 'findUnique',
      clientMethod: 'post.findUnique',
      descriptor: first.descriptor,
      precomputedQueryPlanCacheHit: {
        cacheKey: first.cacheKey,
        placeholderValues: first.placeholderValues,
      },
    })

    expect(matcher?.(nextArgs)).toEqual(next.placeholderValues)
    expect(first.cacheKey).toBe(next.cacheKey)
    expect(matcher?.(blogPageArgs('full', 404))).toBeUndefined()
  })

  test('matches the serializer and parameterizer oracle for the slug blog page template', async () => {
    const oracle = await createBlogPageOracle()
    const { registry } = createRegistryFromDatamodel(oracle.datamodel, ['template:Post.findUnique:slug:blogPagePostV1'])
    const firstArgs = blogPageArgs('full', 'first-post', 'slug')
    const nextArgs = blogPageArgs('full', 'next-post', 'slug')
    const first = oracle.fromArgs(firstArgs)
    const next = oracle.fromArgs(nextArgs)
    const matcher = registry.getMatcher({
      model: 'Post',
      action: 'findUnique',
      clientMethod: 'post.findUnique',
      descriptor: first.descriptor,
      precomputedQueryPlanCacheHit: {
        cacheKey: first.cacheKey,
        placeholderValues: first.placeholderValues,
      },
    })

    expect(matcher?.(nextArgs)).toEqual(next.placeholderValues)
    expect(Object.keys(matcher?.(nextArgs) ?? {})).toEqual(Object.keys(next.placeholderValues))
    expect(first.cacheKey).toBe(next.cacheKey)
    expect(matcher?.(blogPageArgs('full', 202))).toBeUndefined()
    expect(matcher?.({ where: { slug: 202 }, select: nextArgs.select })).toBeUndefined()
  })

  test('matches the serializer and parameterizer oracle for the blog feed template', async () => {
    const oracle = await createBlogPageOracle('findMany', 'post.findMany')
    const { registry } = createRegistryFromDatamodel(oracle.datamodel, [
      'template:Post.findMany:take:blogFeedPostListV1',
    ])
    const firstArgs = blogFeedArgs(10)
    const nextArgs = blogFeedArgs(10)
    const first = oracle.fromArgs(firstArgs)
    const next = oracle.fromArgs(nextArgs)
    const matcher = registry.getMatcher({
      model: 'Post',
      action: 'findMany',
      clientMethod: 'post.findMany',
      descriptor: first.descriptor,
      precomputedQueryPlanCacheHit: {
        cacheKey: first.cacheKey,
        placeholderValues: first.placeholderValues,
      },
    })

    expect(matcher?.(nextArgs)).toEqual(next.placeholderValues)
    expect(Object.keys(matcher?.(nextArgs) ?? {})).toEqual(Object.keys(next.placeholderValues))
    expect(first.cacheKey).toBe(next.cacheKey)
    expect(matcher?.({ orderBy: nextArgs.orderBy, take: nextArgs.take, select: nextArgs.select })).toBeUndefined()
    expect(matcher?.({ ...nextArgs, extra: true })).toBeUndefined()
    expect(matcher?.({ ...nextArgs, take: 11 })).toBeUndefined()
    expect(matcher?.({ ...nextArgs, take: '12' })).toBeUndefined()
    expect(matcher?.({ ...nextArgs, take: 12.5 })).toBeUndefined()
    expect(matcher?.({ ...nextArgs, orderBy: [{ createdAt: 'asc' }] })).toBeUndefined()
    expect(matcher?.({ ...nextArgs, select: { ...nextArgs.select, slug: skip } })).toBeUndefined()
    expect(
      matcher?.({
        ...nextArgs,
        select: { ...nextArgs.select, comments: { ...nextArgs.select.comments, take: 11 } },
      }),
    ).toBeUndefined()
  })
})

function createRegistry(configValue: string[]) {
  return createRegistryFromDatamodel(datamodel, configValue)
}

function createRegistryFromDatamodel(datamodel: DMMF.Datamodel, configValue: string[]) {
  const code = buildExactDescriptorMatcherRegistry(datamodel, configValue, '__factory')
  const config: any = {}
  const flatMatcher = vi.fn()
  const flatGetMatcher = vi.fn(() => flatMatcher)
  const factory = vi.fn(() => ({ getMatcher: flatGetMatcher }))

  vm.runInNewContext(code, { __factory: factory, config })

  return { registry: config.descriptorMatcherRegistry, flatGetMatcher, flatMatcher, factory }
}

async function createBlogPageOracle(
  action: 'findUnique' | 'findMany' = 'findUnique',
  clientMethod = 'post.findUnique',
) {
  const dmmf = await internals.getInternalDMMF({ datamodel: benchmarkSchema })
  if ('error' in dmmf) {
    throw dmmf.error
  }

  const runtimeDataModel = dmmfToRuntimeDataModel(dmmf.datamodel)
  const paramGraph = ParamGraph.fromData(buildParamGraph(dmmf), (enumName) => {
    const enumDef = runtimeDataModel.enums[enumName]
    const mapping: Record<string, string> = {}
    for (const value of enumDef?.values ?? []) {
      mapping[value.name] = value.dbName ?? value.name
    }
    return mapping
  })

  return {
    datamodel: dmmf.datamodel,
    fromArgs(args: Record<string, unknown>) {
      const query = serializeJsonQuery({
        modelName: 'Post',
        runtimeDataModel,
        action,
        args,
        clientMethod,
        errorFormat: 'minimal',
        clientVersion: '0.0.0',
        previewFeatures: [],
      })
      const { parameterizedQuery, placeholderValues } = parameterizeQuery(query, paramGraph)
      const queryPart = JSON.stringify(parameterizedQuery.query)

      return {
        cacheKey: getSingleQueryCacheKey(parameterizedQuery, queryPart),
        descriptor: { root: buildLazyDescriptorNode(args, placeholderValues) },
        placeholderValues,
      }
    },
  }
}

function buildLazyDescriptorNode(value: unknown, placeholderValues: Record<string, unknown>): unknown {
  const placeholderName = getPlaceholderName(value, placeholderValues)
  if (placeholderName !== undefined) {
    return {
      kind: 'placeholder',
      name: placeholderName,
      valueType: descriptorValueType(value),
    }
  }

  if (Array.isArray(value)) {
    return {
      kind: 'array',
      items: value.map((item) => buildLazyDescriptorNode(item, placeholderValues)),
    }
  }

  if (isRecord(value)) {
    const keys = Object.keys(value)
    const fields: Record<string, unknown> = {}
    for (const key of keys) {
      fields[key] = buildLazyDescriptorNode(value[key], placeholderValues)
    }
    return { kind: 'object', keys, fields }
  }

  return { kind: 'constant', value }
}

function getPlaceholderName(value: unknown, placeholderValues: Record<string, unknown>) {
  for (const [name, placeholderValue] of Object.entries(placeholderValues)) {
    if (Object.is(value, placeholderValue)) {
      return name
    }
  }

  return undefined
}

function descriptorValueType(value: unknown): string {
  if (typeof value === 'number' && Number.isInteger(value) && -(2 ** 31) <= value && value <= 2 ** 31 - 1) {
    return 'int32'
  }

  return value === null ? 'null' : typeof value
}

function getStringCacheKeyPart(value: string | undefined): string {
  if (value === undefined) {
    return '-1:'
  }

  return `${value.length}:${value}`
}

function getSingleQueryCacheKey(query: { modelName?: string; action: string }, queryPart: string): string {
  return `s:${getStringCacheKeyPart(query.modelName)}${getStringCacheKeyPart(query.action)}${queryPart.length}:${queryPart}`
}

function blogPageDescriptor(shape: 'full' | 'minimal', field = 'id', valueType: 'int32' | 'string' = 'int32') {
  return {
    root: objectDescriptor(['where', 'select'], {
      where: objectDescriptor([field], { [field]: placeholder('%1', valueType) }),
      select: blogPageSelectDescriptor(shape),
    }),
  }
}

function blogFeedDescriptor() {
  return {
    root: objectDescriptor(['take', 'orderBy', 'select'], {
      take: constant(10),
      orderBy: blogPageOrderByDescriptor(),
      select: blogPageSelectDescriptor('full'),
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
      orderBy: blogPageOrderByDescriptor(),
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

function blogFeedArgs(take: number) {
  return {
    take,
    orderBy: [{ createdAt: 'desc' }],
    select: blogPageArgs('full', 0).select,
  }
}

function blogPageOrderByDescriptor() {
  return { kind: 'array', items: [objectDescriptor(['createdAt'], { createdAt: constant('desc') })] }
}

function blogPageArgs(shape: 'full' | 'minimal', value: number | string, field = 'id') {
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
    where: { [field]: value },
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

function placeholder(name: string, valueType: 'int32' | 'string' = 'int32') {
  return { kind: 'placeholder', name, valueType }
}

function constant(value: unknown) {
  return { kind: 'constant', value }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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
const benchmarkSchema = readFileSync(
  new URL('../../client/src/__tests__/benchmarks/query-performance/schema.prisma', import.meta.url),
  'utf-8',
)
