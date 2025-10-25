import { describe, expect, it, vi } from 'vitest'

import { ensureNeededBinariesExist } from '..'

describe('ensureNeededBinariesExist', () => {
  describe('with hasMigrateAdapterInConfig = true, it should not download schema-engine', () => {
    const hasMigrateAdapterInConfig = true

    describe('clientEngineType = client', () => {
      it('should not download query engine', async () => {
        const download = vi.fn()
        await ensureNeededBinariesExist({
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
  })

  describe('with hasMigrateAdapterInConfig = false, it should download schema-engine', () => {
    const hasMigrateAdapterInConfig = false

    describe('clientEngineType = client', () => {
      it('should not download query engine', async () => {
        const download = vi.fn()
        await ensureNeededBinariesExist({
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
  })
})
