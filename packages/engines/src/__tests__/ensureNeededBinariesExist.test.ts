import { describe, expect, it, vi } from 'vitest'

import { ensureNeededBinariesExist } from '..'

describe('ensureNeededBinariesExist', () => {
  describe('clientEngineType = client', () => {
    it('should not download query engine', async () => {
      const download = vi.fn()
      await ensureNeededBinariesExist({
        clientEngineType: 'client',
        download,
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
