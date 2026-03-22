import { describe, expect, test, vi } from 'vitest'

import { withSpatialOptimization } from '../spatial-optimizer'

describe('withSpatialOptimization', () => {
  test('detects PostgreSQL 16 and applies optimization', async () => {
    const mockPrisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ version: 'PostgreSQL 16.2 on x86_64' }]),
      $executeRaw: vi.fn().mockResolvedValue(undefined),
      $transaction: vi.fn(async (callback) => await callback(mockPrisma)),
    } as any

    const operation = vi.fn().mockResolvedValue('result')

    const result = await withSpatialOptimization(mockPrisma, operation)

    expect(result).toBe('result')
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1)
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
    expect(mockPrisma.$executeRaw).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining('SET LOCAL enable_nestloop = off')]),
    )
    expect(operation).toHaveBeenCalledWith(mockPrisma)
  })

  test('skips optimization for PostgreSQL 17+', async () => {
    const mockPrisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ version: 'PostgreSQL 17.0 on x86_64' }]),
      $executeRaw: vi.fn().mockResolvedValue(undefined),
      $transaction: vi.fn(),
    } as any

    const operation = vi.fn().mockResolvedValue('result')

    const result = await withSpatialOptimization(mockPrisma, operation)

    expect(result).toBe('result')
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled()
    expect(operation).toHaveBeenCalledWith(mockPrisma)
  })

  test('skips optimization for PostgreSQL 15 and earlier', async () => {
    const mockPrisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ version: 'PostgreSQL 15.5 on x86_64' }]),
      $executeRaw: vi.fn().mockResolvedValue(undefined),
      $transaction: vi.fn(),
    } as any

    const operation = vi.fn().mockResolvedValue('result')

    const result = await withSpatialOptimization(mockPrisma, operation)

    expect(result).toBe('result')
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    expect(operation).toHaveBeenCalledWith(mockPrisma)
  })

  test('caches version detection for performance', async () => {
    const mockPrisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ version: 'PostgreSQL 16.2 on x86_64' }]),
      $executeRaw: vi.fn().mockResolvedValue(undefined),
      $transaction: vi.fn(async (callback) => await callback(mockPrisma)),
    } as any

    const operation1 = vi.fn().mockResolvedValue('result1')
    const operation2 = vi.fn().mockResolvedValue('result2')

    await withSpatialOptimization(mockPrisma, operation1)
    await withSpatialOptimization(mockPrisma, operation2)

    // Version should only be queried once (cached)
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1)
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2)
  })

  test('handles version detection errors gracefully', async () => {
    const mockPrisma = {
      $queryRaw: vi.fn().mockRejectedValue(new Error('Connection failed')),
      $executeRaw: vi.fn().mockResolvedValue(undefined),
      $transaction: vi.fn(),
    } as any

    const operation = vi.fn().mockResolvedValue('result')

    // Should not throw, should run operation without optimization
    const result = await withSpatialOptimization(mockPrisma, operation)

    expect(result).toBe('result')
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    expect(operation).toHaveBeenCalledWith(mockPrisma)
  })

  test('handles malformed version strings gracefully', async () => {
    const mockPrisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ version: 'Unknown database version' }]),
      $executeRaw: vi.fn().mockResolvedValue(undefined),
      $transaction: vi.fn(),
    } as any

    const operation = vi.fn().mockResolvedValue('result')

    const result = await withSpatialOptimization(mockPrisma, operation)

    expect(result).toBe('result')
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    expect(operation).toHaveBeenCalledWith(mockPrisma)
  })
})
