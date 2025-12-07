import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { parameterizeQuery } from '../parameterize'

/**
 * Property-based tests for parameterizeQuery.
 *
 * The key property we want to verify is simple:
 * **User data values should never appear in the parameterized output.**
 *
 * We generate arbitrary query shapes containing "canary" values and verify
 * those values don't appear in the JSON-serialized output.
 */

/** A unique marker we can search for in serialized output */
const CANARY_PREFIX = '___CANARY_'

/** Generate a unique canary string */
function canary(id: number): string {
  return `${CANARY_PREFIX}${id}___`
}

/** Check if output contains any canary values */
function containsCanary(output: unknown): boolean {
  const serialized = JSON.stringify(output)
  return serialized.includes(CANARY_PREFIX)
}

/**
 * Create an arbitrary that generates canary-tagged user values.
 * Each value contains a unique canary string that we can search for.
 */
function canaryValueArb(idArb: fc.Arbitrary<number>): fc.Arbitrary<unknown> {
  return fc.oneof(
    // Plain canary string
    idArb.map((id) => canary(id)),
    // Tagged DateTime
    idArb.map((id) => ({ $type: 'DateTime', value: canary(id) })),
    // Tagged Decimal
    idArb.map((id) => ({ $type: 'Decimal', value: canary(id) })),
    // Tagged BigInt
    idArb.map((id) => ({ $type: 'BigInt', value: canary(id) })),
    // Tagged Bytes
    idArb.map((id) => ({ $type: 'Bytes', value: canary(id) })),
    // Tagged Json
    idArb.map((id) => ({ $type: 'Json', value: canary(id) })),
    // Tagged Enum
    idArb.map((id) => ({ $type: 'Enum', value: canary(id) })),
  )
}

/**
 * Create an arbitrary for filter operator objects containing canary values
 */
function filterOperatorArb(idArb: fc.Arbitrary<number>): fc.Arbitrary<Record<string, unknown>> {
  const valueArb = canaryValueArb(idArb)

  return fc.oneof(
    fc.record({ equals: valueArb }),
    fc.record({ not: valueArb }),
    fc.record({ in: fc.array(valueArb, { minLength: 1, maxLength: 3 }) }),
    fc.record({ notIn: fc.array(valueArb, { minLength: 1, maxLength: 3 }) }),
    fc.record({ lt: valueArb }),
    fc.record({ lte: valueArb }),
    fc.record({ gt: valueArb }),
    fc.record({ gte: valueArb }),
    fc.record({ contains: idArb.map((id) => canary(id)) }),
    fc.record({ startsWith: idArb.map((id) => canary(id)) }),
    fc.record({ endsWith: idArb.map((id) => canary(id)) }),
    fc.record({ contains: idArb.map((id) => canary(id)), mode: fc.constant('insensitive') }),
    fc.record({ search: idArb.map((id) => canary(id)) }),
    // Array field operators
    fc.record({ has: valueArb }),
    fc.record({ hasEvery: fc.array(valueArb, { minLength: 1, maxLength: 3 }) }),
    fc.record({ hasSome: fc.array(valueArb, { minLength: 1, maxLength: 3 }) }),
    // JSON operators
    fc.record({
      path: fc.array(
        idArb.map((id) => canary(id)),
        { minLength: 1, maxLength: 3 },
      ),
      equals: valueArb,
    }),
    fc.record({ string_contains: idArb.map((id) => canary(id)) }),
    fc.record({ string_starts_with: idArb.map((id) => canary(id)) }),
    fc.record({ string_ends_with: idArb.map((id) => canary(id)) }),
    fc.record({ array_contains: valueArb }),
  )
}

/**
 * Create an arbitrary for where clause field values (either direct value or filter operator)
 */
function whereFieldValueArb(idArb: fc.Arbitrary<number>): fc.Arbitrary<unknown> {
  return fc.oneof(canaryValueArb(idArb), filterOperatorArb(idArb))
}

/**
 * Create an arbitrary for simple where clauses (field -> value mappings)
 */
function simpleWhereArb(idArb: fc.Arbitrary<number>): fc.Arbitrary<Record<string, unknown>> {
  return fc.dictionary(
    fc.constantFrom('id', 'email', 'name', 'status', 'age', 'isActive', 'createdAt', 'content', 'title'),
    whereFieldValueArb(idArb),
    { minKeys: 1, maxKeys: 4 },
  )
}

/**
 * Create an arbitrary for relation filter operators (some, every, none)
 */
function relationFilterArb(
  whereArb: fc.Arbitrary<Record<string, unknown>>,
): fc.Arbitrary<Record<string, Record<string, unknown>>> {
  return fc.oneof(
    fc.record({ posts: fc.record({ some: whereArb }) }),
    fc.record({ posts: fc.record({ every: whereArb }) }),
    fc.record({ posts: fc.record({ none: whereArb }) }),
    fc.record({ comments: fc.record({ some: whereArb }) }),
    fc.record({ author: fc.record({ is: whereArb }) }),
    fc.record({ profile: fc.record({ isNot: whereArb }) }),
  )
}

/**
 * Create an arbitrary for where clauses with logical operators and nesting
 */
function whereClauseArb(idArb: fc.Arbitrary<number>, maxDepth: number = 3): fc.Arbitrary<Record<string, unknown>> {
  const simpleWhere = simpleWhereArb(idArb)

  if (maxDepth <= 1) {
    return simpleWhere
  }

  const recurse = whereClauseArb(idArb, maxDepth - 1)

  return fc.oneof(
    { weight: 3, arbitrary: simpleWhere },
    { weight: 1, arbitrary: fc.record({ AND: fc.array(recurse, { minLength: 1, maxLength: 3 }) }) },
    { weight: 1, arbitrary: fc.record({ OR: fc.array(recurse, { minLength: 1, maxLength: 3 }) }) },
    { weight: 1, arbitrary: fc.record({ NOT: recurse }) },
    { weight: 1, arbitrary: relationFilterArb(simpleWhere) },
    // Combined: simple fields + logical operator
    {
      weight: 1,
      arbitrary: fc.record({
        field1: whereFieldValueArb(idArb),
        AND: fc.array(recurse, { minLength: 1, maxLength: 2 }),
      }),
    },
  )
}

/**
 * Create an arbitrary for data objects (for create/update operations)
 */
function dataObjectArb(idArb: fc.Arbitrary<number>): fc.Arbitrary<Record<string, unknown>> {
  return fc.dictionary(
    fc.constantFrom('email', 'name', 'title', 'content', 'status', 'age', 'isActive', 'bio'),
    canaryValueArb(idArb),
    { minKeys: 1, maxKeys: 5 },
  )
}

/**
 * Create an arbitrary for nested relation operations in data context
 */
function nestedDataOperationArb(idArb: fc.Arbitrary<number>): fc.Arbitrary<Record<string, unknown>> {
  const simpleData = dataObjectArb(idArb)

  return fc.oneof(
    // create
    fc.record({ posts: fc.record({ create: simpleData }) }),
    fc.record({ posts: fc.record({ create: fc.array(simpleData, { minLength: 1, maxLength: 2 }) }) }),
    // createMany
    fc.record({
      posts: fc.record({ createMany: fc.record({ data: fc.array(simpleData, { minLength: 1, maxLength: 2 }) }) }),
    }),
    // connect
    fc.record({ profile: fc.record({ connect: fc.record({ id: idArb.map((id) => canary(id)) }) }) }),
    fc.record({
      tags: fc.record({
        connect: fc.array(fc.record({ id: idArb.map((id) => canary(id)) }), { minLength: 1, maxLength: 3 }),
      }),
    }),
    // connectOrCreate
    fc.record({
      profile: fc.record({
        connectOrCreate: fc.record({
          where: fc.record({ id: idArb.map((id) => canary(id)) }),
          create: simpleData,
        }),
      }),
    }),
    // update
    fc.record({ profile: fc.record({ update: simpleData }) }),
    // upsert
    fc.record({
      profile: fc.record({
        upsert: fc.record({
          create: simpleData,
          update: simpleData,
        }),
      }),
    }),
    // disconnect
    fc.record({
      tags: fc.record({
        disconnect: fc.array(fc.record({ id: idArb.map((id) => canary(id)) }), { minLength: 1, maxLength: 2 }),
      }),
    }),
    // set
    fc.record({
      tags: fc.record({
        set: fc.array(fc.record({ id: idArb.map((id) => canary(id)) }), { minLength: 1, maxLength: 3 }),
      }),
    }),
    // delete
    fc.record({ posts: fc.record({ delete: fc.record({ id: idArb.map((id) => canary(id)) }) }) }),
    // deleteMany
    fc.record({ posts: fc.record({ deleteMany: fc.record({ where: simpleWhereArb(idArb) }) }) }),
    // updateMany
    fc.record({
      posts: fc.record({
        updateMany: fc.record({
          where: simpleWhereArb(idArb),
          data: simpleData,
        }),
      }),
    }),
  )
}

/**
 * Create an arbitrary for the full data clause (simple fields + optional nested operations)
 */
function fullDataArb(idArb: fc.Arbitrary<number>): fc.Arbitrary<Record<string, unknown>> {
  return fc.oneof(
    dataObjectArb(idArb),
    // Data with nested relation operation
    fc.tuple(dataObjectArb(idArb), nestedDataOperationArb(idArb)).map(([simple, nested]) => ({ ...simple, ...nested })),
  )
}

/**
 * Create an arbitrary for selection objects
 */
function selectionArb(maxDepth: number = 2): fc.Arbitrary<Record<string, unknown>> {
  const simpleSelection = fc.record({
    $scalars: fc.constant(true as const),
  })

  if (maxDepth <= 1) {
    return simpleSelection
  }

  const nestedSelection = selectionArb(maxDepth - 1)

  return fc.oneof(
    simpleSelection,
    fc.record({
      $scalars: fc.constant(true as const),
      $composites: fc.boolean(),
    }),
    // With nested relation selection
    fc.record({
      $scalars: fc.constant(true as const),
      posts: fc.record({
        selection: nestedSelection,
      }),
    }),
    fc.record({
      $scalars: fc.constant(true as const),
      author: fc.record({
        selection: nestedSelection,
      }),
    }),
    // With nested relation selection + arguments
    fc.record({
      $scalars: fc.constant(true as const),
      posts: fc.record({
        arguments: fc.record({
          take: fc.integer({ min: 1, max: 100 }),
          skip: fc.integer({ min: 0, max: 100 }),
        }),
        selection: nestedSelection,
      }),
    }),
  )
}

/**
 * Create an arbitrary for orderBy clauses
 */
function orderByArb(): fc.Arbitrary<Record<string, unknown> | Record<string, unknown>[]> {
  const simpleOrderBy: fc.Arbitrary<Record<string, unknown>> = fc
    .constantFrom('createdAt', 'updatedAt', 'name', 'id')
    .chain((field) =>
      fc.record({
        [field]: fc.record({
          sort: fc.constantFrom('asc', 'desc'),
          nulls: fc.constantFrom('first', 'last'),
        }),
      }),
    )

  return fc.oneof(simpleOrderBy, fc.array(simpleOrderBy, { minLength: 1, maxLength: 3 }))
}

/**
 * Create an arbitrary for cursor objects
 */
function cursorArb(idArb: fc.Arbitrary<number>): fc.Arbitrary<Record<string, unknown>> {
  return fc.oneof(
    fc.record({ id: idArb.map((id) => canary(id)) }),
    fc.record({
      email_tenantId: fc.record({
        email: idArb.map((id) => canary(id)),
        tenantId: idArb.map((id) => canary(id)),
      }),
    }),
  )
}

/**
 * Create an arbitrary for complete query-like objects
 */
function queryArb(idArb: fc.Arbitrary<number>): fc.Arbitrary<Record<string, unknown>> {
  return fc.record(
    {
      arguments: fc.record(
        {
          where: whereClauseArb(idArb),
          data: fullDataArb(idArb),
          take: fc.integer({ min: 1, max: 100 }),
          skip: fc.integer({ min: 0, max: 100 }),
          orderBy: orderByArb(),
          cursor: cursorArb(idArb),
          distinct: fc.array(fc.constantFrom('email', 'name', 'id', 'createdAt'), { minLength: 1, maxLength: 3 }),
        },
        { requiredKeys: [] },
      ),
      selection: selectionArb(),
    },
    { requiredKeys: ['selection'] },
  )
}

/**
 * Create an arbitrary for queries focused on where clauses
 */
function whereQueryArb(idArb: fc.Arbitrary<number>): fc.Arbitrary<Record<string, unknown>> {
  return fc.record({
    arguments: fc.record({
      where: whereClauseArb(idArb, 4),
    }),
    selection: fc.record({ $scalars: fc.constant(true as const) }),
  })
}

/**
 * Create an arbitrary for queries focused on data operations
 */
function dataQueryArb(idArb: fc.Arbitrary<number>): fc.Arbitrary<Record<string, unknown>> {
  return fc.record({
    arguments: fc.record({
      data: fullDataArb(idArb),
    }),
    selection: fc.record({ $scalars: fc.constant(true as const) }),
  })
}

/**
 * Create an arbitrary for queries with deeply nested selections
 */
function nestedSelectionQueryArb(idArb: fc.Arbitrary<number>): fc.Arbitrary<Record<string, unknown>> {
  return fc.record({
    arguments: fc.record({
      where: simpleWhereArb(idArb),
      take: fc.integer({ min: 1, max: 50 }),
    }),
    selection: selectionArb(4),
  })
}

describe('parameterizeQuery - property-based tests', () => {
  // Use a mapped arbitrary to generate unique IDs for each test run
  const idArb = fc.integer({ min: 0, max: 100000 })

  describe('no user data leakage', () => {
    it('does not leak canary values from arbitrary where clauses', () => {
      fc.assert(
        fc.property(whereQueryArb(idArb), (query) => {
          const result = parameterizeQuery(query)
          expect(containsCanary(result)).toBe(false)
        }),
        { numRuns: 500 },
      )
    })

    it('does not leak canary values from arbitrary data operations', () => {
      fc.assert(
        fc.property(dataQueryArb(idArb), (query) => {
          const result = parameterizeQuery(query)
          expect(containsCanary(result)).toBe(false)
        }),
        { numRuns: 500 },
      )
    })

    it('does not leak canary values from arbitrary complete queries', () => {
      fc.assert(
        fc.property(queryArb(idArb), (query) => {
          const result = parameterizeQuery(query)
          expect(containsCanary(result)).toBe(false)
        }),
        { numRuns: 500 },
      )
    })

    it('does not leak canary values from queries with nested selections', () => {
      fc.assert(
        fc.property(nestedSelectionQueryArb(idArb), (query) => {
          const result = parameterizeQuery(query)
          expect(containsCanary(result)).toBe(false)
        }),
        { numRuns: 300 },
      )
    })

    it('does not leak canary values from deeply nested logical operators', () => {
      // Generate extra-deep nesting specifically
      fc.assert(
        fc.property(idArb, (baseId) => {
          // Manually construct a deeply nested structure
          let where: Record<string, unknown> = { field: canary(baseId) }
          for (let i = 0; i < 6; i++) {
            const op = ['AND', 'OR', 'NOT'][i % 3]
            if (op === 'NOT') {
              where = { NOT: where }
            } else {
              where = { [op]: [where, { anotherField: canary(baseId + i + 1) }] }
            }
          }

          const query = {
            arguments: { where },
            selection: { $scalars: true },
          }

          const result = parameterizeQuery(query)
          expect(containsCanary(result)).toBe(false)
        }),
        { numRuns: 200 },
      )
    })
  })

  describe('structural guarantees', () => {
    it('is deterministic: same input always produces same output', () => {
      fc.assert(
        fc.property(queryArb(idArb), (query) => {
          const result1 = JSON.stringify(parameterizeQuery(query))
          const result2 = JSON.stringify(parameterizeQuery(query))
          expect(result1).toBe(result2)
        }),
        { numRuns: 200 },
      )
    })

    it('is idempotent: parameterizing twice yields same result', () => {
      fc.assert(
        fc.property(queryArb(idArb), (query) => {
          const once = parameterizeQuery(query)
          const twice = parameterizeQuery(once)
          expect(JSON.stringify(once)).toBe(JSON.stringify(twice))
        }),
        { numRuns: 200 },
      )
    })

    it('always produces JSON-serializable output', () => {
      fc.assert(
        fc.property(queryArb(idArb), (query) => {
          const result = parameterizeQuery(query)
          // Should not throw
          const serialized = JSON.stringify(result)
          expect(typeof serialized).toBe('string')
          // Should be parseable
          expect(() => JSON.parse(serialized)).not.toThrow()
        }),
        { numRuns: 200 },
      )
    })

    it('preserves null values in where clauses', () => {
      fc.assert(
        fc.property(idArb, (id) => {
          const query = {
            arguments: {
              where: { deletedAt: null, name: canary(id) },
            },
            selection: { $scalars: true },
          }

          const result = parameterizeQuery(query) as { arguments: { where: { deletedAt: unknown } } }
          expect(result.arguments.where.deletedAt).toBe(null)
        }),
        { numRuns: 100 },
      )
    })

    it('preserves take and skip at top level', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1000 }), fc.integer({ min: 0, max: 1000 }), (take, skip) => {
          const query = {
            arguments: { take, skip },
            selection: { $scalars: true },
          }

          const result = parameterizeQuery(query) as { arguments: { take: number; skip: number } }
          expect(result.arguments.take).toBe(take)
          expect(result.arguments.skip).toBe(skip)
        }),
        { numRuns: 100 },
      )
    })

    it('preserves sort directions in orderBy', () => {
      fc.assert(
        fc.property(fc.constantFrom('asc', 'desc'), fc.constantFrom('first', 'last'), (sort, nulls) => {
          const query = {
            arguments: {
              orderBy: { createdAt: { sort, nulls } },
            },
            selection: { $scalars: true },
          }

          const result = parameterizeQuery(query) as {
            arguments: { orderBy: { createdAt: { sort: string; nulls: string } } }
          }
          expect(result.arguments.orderBy.createdAt.sort).toBe(sort)
          expect(result.arguments.orderBy.createdAt.nulls).toBe(nulls)
        }),
        { numRuns: 50 },
      )
    })

    it('preserves selection markers', () => {
      fc.assert(
        fc.property(fc.boolean(), fc.boolean(), (scalars, composites) => {
          const query = {
            selection: { $scalars: scalars, $composites: composites },
          }

          const result = parameterizeQuery(query) as {
            selection: { $scalars: boolean; $composites: boolean }
          }
          expect(result.selection.$scalars).toBe(scalars)
          expect(result.selection.$composites).toBe(composites)
        }),
        { numRuns: 50 },
      )
    })
  })
})
