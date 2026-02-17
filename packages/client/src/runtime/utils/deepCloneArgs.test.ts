import { isSkip, skip } from '../core/types'
import { deepCloneArgs } from './deepCloneArgs'

describe('deepCloneArgs', () => {
  test('preserves Skip instances through cloning', () => {
    const args = {
      data: {
        name: skip,
        email: 'test@example.com',
      },
    }

    const cloned = deepCloneArgs(args) as Record<string, any>

    expect(isSkip(cloned.data.name)).toBe(true)
    expect(cloned.data.name).toBe(skip)
    expect(cloned.data.email).toBe('test@example.com')
  })

  test('preserves Skip as a top-level value', () => {
    const args = {
      where: skip,
      orderBy: { name: 'asc' },
    }

    const cloned = deepCloneArgs(args) as Record<string, any>

    expect(isSkip(cloned.where)).toBe(true)
    expect(cloned.where).toBe(skip)
  })

  test('preserves Skip in arrays', () => {
    const args = {
      data: [skip, 'value'],
    }

    const cloned = deepCloneArgs(args) as Record<string, any>

    expect(isSkip(cloned.data[0])).toBe(true)
  })

  test('still deep clones regular objects', () => {
    const inner = { foo: 'bar' }
    const args = { data: inner }

    const cloned = deepCloneArgs(args) as Record<string, any>

    expect(cloned.data).toEqual(inner)
    expect(cloned.data).not.toBe(inner)
  })
})
