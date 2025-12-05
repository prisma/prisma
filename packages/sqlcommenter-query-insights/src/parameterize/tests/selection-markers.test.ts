import { describe, expect, it } from 'vitest'

import { parameterizeQuery } from '../parameterize'

describe('parameterizeQuery - selection markers', () => {
  it('preserves $scalars marker', () => {
    const query = {
      selection: { $scalars: true },
    }

    expect(parameterizeQuery(query)).toEqual({
      selection: { $scalars: true },
    })
  })

  it('preserves $composites marker', () => {
    const query = {
      selection: { $composites: true },
    }

    expect(parameterizeQuery(query)).toEqual({
      selection: { $composites: true },
    })
  })

  it('preserves both markers together', () => {
    const query = {
      selection: { $scalars: true, $composites: true },
    }

    expect(parameterizeQuery(query)).toEqual({
      selection: { $scalars: true, $composites: true },
    })
  })

  it('preserves false values for selection markers', () => {
    const query = {
      selection: { $scalars: false, $composites: false },
    }

    expect(parameterizeQuery(query)).toEqual({
      selection: { $scalars: false, $composites: false },
    })
  })

  it('preserves selection markers in nested selections', () => {
    const query = {
      selection: {
        $scalars: true,
        posts: {
          selection: {
            $scalars: true,
            $composites: true,
          },
        },
      },
    }

    expect(parameterizeQuery(query)).toEqual({
      selection: {
        $scalars: true,
        posts: {
          selection: {
            $scalars: true,
            $composites: true,
          },
        },
      },
    })
  })

  it('preserves boolean field selections alongside markers', () => {
    const query = {
      selection: {
        $scalars: true,
        id: true,
        name: true,
        email: false,
      },
    }

    expect(parameterizeQuery(query)).toEqual({
      selection: {
        $scalars: true,
        id: true,
        name: true,
        email: false,
      },
    })
  })

  it('preserves nested relation selections with markers', () => {
    const query = {
      selection: {
        $scalars: true,
        author: {
          selection: {
            $scalars: true,
          },
        },
        comments: {
          selection: {
            $composites: true,
            author: {
              selection: {
                $scalars: true,
              },
            },
          },
        },
      },
    }

    expect(parameterizeQuery(query)).toEqual({
      selection: {
        $scalars: true,
        author: {
          selection: {
            $scalars: true,
          },
        },
        comments: {
          selection: {
            $composites: true,
            author: {
              selection: {
                $scalars: true,
              },
            },
          },
        },
      },
    })
  })
})
