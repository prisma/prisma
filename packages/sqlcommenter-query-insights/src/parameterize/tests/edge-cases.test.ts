import { describe, expect, it } from 'vitest'

import { PARAM_PLACEHOLDER, parameterizeQuery } from '../parameterize'

describe('parameterizeQuery - edge cases', () => {
  it('handles empty objects', () => {
    const query = {
      arguments: {
        where: {},
      },
      selection: { $scalars: true },
    }

    expect(parameterizeQuery(query)).toEqual({
      arguments: {
        where: {},
      },
      selection: { $scalars: true },
    })
  })

  it('handles empty arrays', () => {
    const query = {
      arguments: {
        where: {
          id: { in: [] },
        },
      },
      selection: { $scalars: true },
    }

    expect(parameterizeQuery(query)).toEqual({
      arguments: {
        where: {
          id: { in: [] },
        },
      },
      selection: { $scalars: true },
    })
  })

  it('handles deeply nested empty structures', () => {
    const query = {
      arguments: {
        where: {
          AND: [{ OR: [] }, {}],
        },
      },
      selection: {},
    }

    expect(parameterizeQuery(query)).toEqual({
      arguments: {
        where: {
          AND: [{ OR: [] }, {}],
        },
      },
      selection: {},
    })
  })

  it('handles query with no arguments', () => {
    const query = {
      selection: { $scalars: true },
    }

    expect(parameterizeQuery(query)).toEqual({
      selection: { $scalars: true },
    })
  })

  it('handles query with empty arguments', () => {
    const query = {
      arguments: {},
      selection: { $scalars: true },
    }

    expect(parameterizeQuery(query)).toEqual({
      arguments: {},
      selection: { $scalars: true },
    })
  })

  it('handles null at top level', () => {
    expect(parameterizeQuery(null)).toEqual(null)
  })

  it('handles undefined at top level', () => {
    expect(parameterizeQuery(undefined)).toEqual(undefined)
  })

  it('handles primitive at top level', () => {
    expect(parameterizeQuery('string')).toEqual(PARAM_PLACEHOLDER)
    expect(parameterizeQuery(123)).toEqual(PARAM_PLACEHOLDER)
    expect(parameterizeQuery(true)).toEqual(PARAM_PLACEHOLDER)
  })

  it('handles array at top level', () => {
    expect(parameterizeQuery(['a', 'b', 'c'])).toEqual([PARAM_PLACEHOLDER, PARAM_PLACEHOLDER, PARAM_PLACEHOLDER])
  })

  it('handles mixed array with objects and primitives', () => {
    const query = {
      arguments: {
        where: {
          OR: [{ status: 'ACTIVE' }, 'literal', 123],
        },
      },
      selection: { $scalars: true },
    }

    expect(parameterizeQuery(query)).toEqual({
      arguments: {
        where: {
          OR: [{ status: PARAM_PLACEHOLDER }, PARAM_PLACEHOLDER, PARAM_PLACEHOLDER],
        },
      },
      selection: { $scalars: true },
    })
  })

  it('handles very deeply nested structures', () => {
    const query = {
      arguments: {
        where: {
          AND: [
            {
              OR: [
                {
                  NOT: {
                    AND: [{ field: 'value' }],
                  },
                },
              ],
            },
          ],
        },
      },
      selection: { $scalars: true },
    }

    expect(parameterizeQuery(query)).toEqual({
      arguments: {
        where: {
          AND: [
            {
              OR: [
                {
                  NOT: {
                    AND: [{ field: PARAM_PLACEHOLDER }],
                  },
                },
              ],
            },
          ],
        },
      },
      selection: { $scalars: true },
    })
  })
})
