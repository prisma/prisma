import { describe, expect, it, vi } from 'vitest'

import { ensureNeededBinariesExist } from '..'

describe('ensureNeededBinariesExist', () => {
  describe('with hasMigrateAdapterInConfig = true, it should not download schema-engine', () => {
    const hasMigrateAdapterInConfig = true

    describe('clientEngineType = client', () => {
      it('should not download query engine', async () => {
        const download = vi.fn()
        await ensureNeededBinariesExist({
          clientEngineType: 'client',
          download,
          hasMigrateAdapterInConfig,
        })
        expect(download).toHaveBeenCalledWith(
          expect.objectContaining({
            binaries: {},
          }),
        )
      })
    })

    describe('clientEngineType = library', () => {
      it('should download library query engine', async () => {
        const download = vi.fn()
        await ensureNeededBinariesExist({
          clientEngineType: 'library',
          download,
          hasMigrateAdapterInConfig,
        })
        expect(download).toHaveBeenCalledWith(
          expect.objectContaining({
            binaries: {
              'libquery-engine': expect.any(String),
            },
          }),
        )
      })
    })

    describe('clientEngineType = binary', () => {
      it('should download binary query engine', async () => {
        const download = vi.fn()
        await ensureNeededBinariesExist({
          clientEngineType: 'binary',
          download,
          hasMigrateAdapterInConfig,
        })
        expect(download).toHaveBeenCalledWith(
          expect.objectContaining({
            binaries: {
              'query-engine': expect.any(String),
            },
          }),
        )
      })
    })
  })

  describe('with hasMigrateAdapterInConfig = false, it should download schema-engine', () => {
    const hasMigrateAdapterInConfig = false

    describe('clientEngineType = client', () => {
      it('should not download query engine', async () => {
        const download = vi.fn()
        await ensureNeededBinariesExist({
          clientEngineType: 'client',
          download,
          hasMigrateAdapterInConfig,
        })
        expect(download).toHaveBeenCalledWith(
          expect.objectContaining({
            binaries: {
              'schema-engine': expect.any(String),
            },
          }),
        )
      })
    })

    describe('clientEngineType = library', () => {
      it('should download library query engine', async () => {
        const download = vi.fn()
        await ensureNeededBinariesExist({
          clientEngineType: 'library',
          download,
          hasMigrateAdapterInConfig,
        })
        expect(download).toHaveBeenCalledWith(
          expect.objectContaining({
            binaries: {
              'schema-engine': expect.any(String),
              'libquery-engine': expect.any(String),
            },
          }),
        )
      })
    })

    describe('clientEngineType = binary', () => {
      it('should download binary query engine', async () => {
        const download = vi.fn()
        await ensureNeededBinariesExist({
          clientEngineType: 'binary',
          download,
          hasMigrateAdapterInConfig,
        })
        expect(download).toHaveBeenCalledWith(
          expect.objectContaining({
            binaries: {
              'schema-engine': expect.any(String),
              'query-engine': expect.any(String),
            },
          }),
        )
      })
    })
  })
})
