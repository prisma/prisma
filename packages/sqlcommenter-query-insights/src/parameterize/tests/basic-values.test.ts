import { describe, expect, it } from 'vitest'

import { PARAM_PLACEHOLDER, parameterizeQuery } from '../parameterize'

describe('parameterizeQuery - basic values', () => {
  it('parameterizes string values in filter context', () => {
    const query = {
      arguments: {
        where: {
          email: 'user@example.com',
        },
      },
      selection: { $scalars: true },
    }

    expect(parameterizeQuery(query)).toEqual({
      arguments: {
        where: {
          email: PARAM_PLACEHOLDER,
        },
      },
      selection: { $scalars: true },
    })
  })

  it('parameterizes number values in filter context', () => {
    const query = {
      arguments: {
        where: {
          id: 123,
        },
      },
      selection: { $scalars: true },
    }

    expect(parameterizeQuery(query)).toEqual({
      arguments: {
        where: {
          id: PARAM_PLACEHOLDER,
        },
      },
      selection: { $scalars: true },
    })
  })

  it('parameterizes boolean values in filter context', () => {
    const query = {
      arguments: {
        where: {
          isActive: true,
        },
      },
      selection: { $scalars: true },
    }

    expect(parameterizeQuery(query)).toEqual({
      arguments: {
        where: {
          isActive: PARAM_PLACEHOLDER,
        },
      },
      selection: { $scalars: true },
    })
  })

  it('preserves null values', () => {
    const query = {
      arguments: {
        where: {
          deletedAt: null,
        },
      },
      selection: { $scalars: true },
    }

    expect(parameterizeQuery(query)).toEqual({
      arguments: {
        where: {
          deletedAt: null,
        },
      },
      selection: { $scalars: true },
    })
  })

  it('preserves undefined values', () => {
    const query = {
      arguments: {
        where: {
          field: undefined,
        },
      },
      selection: { $scalars: true },
    }

    expect(parameterizeQuery(query)).toEqual({
      arguments: {
        where: {
          field: undefined,
        },
      },
      selection: { $scalars: true },
    })
  })
})
