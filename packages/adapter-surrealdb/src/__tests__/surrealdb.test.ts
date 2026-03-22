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
    // Type-level test: ensure the interface shape is correct
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
  test('PrismaSurrealDbAdapterFactory can be constructed with URL string', () => {
    // This test verifies the factory accepts a URL string without throwing
    const { PrismaSurrealDb } = require('../index')
    const factory = new PrismaSurrealDb('surrealdb://root:root@localhost:8000/test/test')
    expect(factory.provider).toBe('surrealdb')
    expect(factory.adapterName).toBe('@prisma/adapter-surrealdb')
  })

  test('PrismaSurrealDbAdapterFactory can be constructed with options', () => {
    const { PrismaSurrealDb } = require('../index')
    const factory = new PrismaSurrealDb('surrealdb://localhost:8000', {
      namespace: 'myns',
      database: 'mydb',
    })
    expect(factory.provider).toBe('surrealdb')
  })
})

describe('Adapter provider and name', () => {
  test('provider is surrealdb', () => {
    const { PrismaSurrealDb } = require('../index')
    const factory = new PrismaSurrealDb('surrealdb://localhost:8000')
    expect(factory.provider).toBe('surrealdb')
  })

  test('adapterName is @prisma/adapter-surrealdb', () => {
    const { PrismaSurrealDb } = require('../index')
    const factory = new PrismaSurrealDb('surrealdb://localhost:8000')
    expect(factory.adapterName).toBe('@prisma/adapter-surrealdb')
  })
})
