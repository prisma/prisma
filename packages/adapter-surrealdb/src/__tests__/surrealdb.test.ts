import { describe, expect, test } from 'vitest'

describe('PrismaSurrealDbAdapterFactory', () => {
  test('exports PrismaSurrealDb from index', async () => {
    const mod = await import('../index')
    expect(mod.PrismaSurrealDb).toBeDefined()
    expect(typeof mod.PrismaSurrealDb).toBe('function')
  })
})

describe('PrismaSurrealDbOptions interface', () => {
  test('accepts namespace and database', () => {
    const options: import('../surrealdb').PrismaSurrealDbOptions = {
      namespace: 'test',
      database: 'prisma',
    }
    expect(options.namespace).toBe('test')
    expect(options.database).toBe('prisma')
  })

  test('allows empty options', () => {
    const options: import('../surrealdb').PrismaSurrealDbOptions = {}
    expect(options.namespace).toBeUndefined()
  })
})

describe('URL credential parsing', () => {
  test('can be constructed with URL string', async () => {
    const { PrismaSurrealDb } = await import('../index')
    const factory = new PrismaSurrealDb('surrealdb://root:root@localhost:8000/test/test')
    expect(factory.provider).toBe('surrealdb')
    expect(factory.adapterName).toBe('@prisma/adapter-surrealdb')
  })

  test('can be constructed with options', async () => {
    const { PrismaSurrealDb } = await import('../index')
    const factory = new PrismaSurrealDb('surrealdb://localhost:8000', {
      namespace: 'myns',
      database: 'mydb',
    })
    expect(factory.provider).toBe('surrealdb')
  })
})

describe('Adapter provider and name', () => {
  test('provider is surrealdb', async () => {
    const { PrismaSurrealDb } = await import('../index')
    const factory = new PrismaSurrealDb('surrealdb://localhost:8000')
    expect(factory.provider).toBe('surrealdb')
  })

  test('adapterName is @prisma/adapter-surrealdb', async () => {
    const { PrismaSurrealDb } = await import('../index')
    const factory = new PrismaSurrealDb('surrealdb://localhost:8000')
    expect(factory.adapterName).toBe('@prisma/adapter-surrealdb')
  })
})
