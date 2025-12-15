import { describe, expect, it } from 'vitest'

import { PARAM_PLACEHOLDER, parameterizeQuery } from '../parameterize'

describe('parameterizeQuery - tagged values', () => {
  it('parameterizes DateTime tagged values', () => {
    const query = {
      arguments: {
        where: {
          createdAt: { $type: 'DateTime', value: '2024-01-01T00:00:00Z' },
        },
      },
      selection: { $scalars: true },
    }

    expect(parameterizeQuery(query)).toEqual({
      arguments: {
        where: {
          createdAt: PARAM_PLACEHOLDER,
        },
      },
      selection: { $scalars: true },
    })
  })

  it('parameterizes Decimal tagged values', () => {
    const query = {
      arguments: {
        where: {
          price: { $type: 'Decimal', value: '99.99' },
        },
      },
      selection: { $scalars: true },
    }

    expect(parameterizeQuery(query)).toEqual({
      arguments: {
        where: {
          price: PARAM_PLACEHOLDER,
        },
      },
      selection: { $scalars: true },
    })
  })

  it('parameterizes BigInt tagged values', () => {
    const query = {
      arguments: {
        where: {
          bigNum: { $type: 'BigInt', value: '9007199254740993' },
        },
      },
      selection: { $scalars: true },
    }

    expect(parameterizeQuery(query)).toEqual({
      arguments: {
        where: {
          bigNum: PARAM_PLACEHOLDER,
        },
      },
      selection: { $scalars: true },
    })
  })

  it('parameterizes Bytes tagged values', () => {
    const query = {
      arguments: {
        where: {
          data: { $type: 'Bytes', value: 'SGVsbG8gV29ybGQ=' },
        },
      },
      selection: { $scalars: true },
    }

    expect(parameterizeQuery(query)).toEqual({
      arguments: {
        where: {
          data: PARAM_PLACEHOLDER,
        },
      },
      selection: { $scalars: true },
    })
  })

  it('parameterizes Json tagged values', () => {
    const query = {
      arguments: {
        where: {
          metadata: { $type: 'Json', value: '{"key":"value"}' },
        },
      },
      selection: { $scalars: true },
    }

    expect(parameterizeQuery(query)).toEqual({
      arguments: {
        where: {
          metadata: PARAM_PLACEHOLDER,
        },
      },
      selection: { $scalars: true },
    })
  })

  it('parameterizes Enum tagged values', () => {
    const query = {
      arguments: {
        where: {
          status: { $type: 'Enum', value: 'ACTIVE' },
        },
      },
      selection: { $scalars: true },
    }

    expect(parameterizeQuery(query)).toEqual({
      arguments: {
        where: {
          status: PARAM_PLACEHOLDER,
        },
      },
      selection: { $scalars: true },
    })
  })

  it('parameterizes Raw tagged values', () => {
    const query = {
      arguments: {
        where: {
          field: { $type: 'Raw', value: 'some raw value' },
        },
      },
      selection: { $scalars: true },
    }

    expect(parameterizeQuery(query)).toEqual({
      arguments: {
        where: {
          field: PARAM_PLACEHOLDER,
        },
      },
      selection: { $scalars: true },
    })
  })

  it('preserves FieldRef tagged values (structural)', () => {
    const fieldRef = { $type: 'FieldRef', value: { _ref: 'otherField', _container: 'Model' } }
    const query = {
      arguments: {
        where: {
          field: { equals: fieldRef },
        },
      },
      selection: { $scalars: true },
    }

    expect(parameterizeQuery(query)).toEqual({
      arguments: {
        where: {
          field: { equals: fieldRef },
        },
      },
      selection: { $scalars: true },
    })
  })

  it('parameterizes tagged values in data context', () => {
    const query = {
      arguments: {
        data: {
          createdAt: { $type: 'DateTime', value: '2024-01-01T00:00:00Z' },
          price: { $type: 'Decimal', value: '99.99' },
          metadata: { $type: 'Json', value: '{"key":"value"}' },
        },
      },
      selection: { $scalars: true },
    }

    expect(parameterizeQuery(query)).toEqual({
      arguments: {
        data: {
          createdAt: PARAM_PLACEHOLDER,
          price: PARAM_PLACEHOLDER,
          metadata: PARAM_PLACEHOLDER,
        },
      },
      selection: { $scalars: true },
    })
  })

  it('parameterizes tagged values in nested filter operators', () => {
    const query = {
      arguments: {
        where: {
          createdAt: {
            gte: { $type: 'DateTime', value: '2024-01-01T00:00:00Z' },
            lt: { $type: 'DateTime', value: '2024-12-31T23:59:59Z' },
          },
        },
      },
      selection: { $scalars: true },
    }

    expect(parameterizeQuery(query)).toEqual({
      arguments: {
        where: {
          createdAt: {
            gte: PARAM_PLACEHOLDER,
            lt: PARAM_PLACEHOLDER,
          },
        },
      },
      selection: { $scalars: true },
    })
  })

  it('parameterizes tagged values in arrays', () => {
    const query = {
      arguments: {
        where: {
          status: {
            in: [
              { $type: 'Enum', value: 'ACTIVE' },
              { $type: 'Enum', value: 'PENDING' },
            ],
          },
        },
      },
      selection: { $scalars: true },
    }

    expect(parameterizeQuery(query)).toEqual({
      arguments: {
        where: {
          status: {
            in: [PARAM_PLACEHOLDER, PARAM_PLACEHOLDER],
          },
        },
      },
      selection: { $scalars: true },
    })
  })
})
