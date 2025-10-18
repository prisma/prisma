import { describe, expect, it, vi } from 'vitest'

import { ensureNeededBinariesExist } from '..'

describe('ensureNeededBinariesExist', () => {
  describe('with hasMigrateAdapterInConfig = true', () => {
    const hasMigrateAdapterInConfig = true

    it('should not download any engines', async () => {
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

  describe('with hasMigrateAdapterInConfig = false', () => {
    const hasMigrateAdapterInConfig = false

    it('should only download schema-engine', async () => {
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
})
