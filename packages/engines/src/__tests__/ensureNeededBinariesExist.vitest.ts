import { describe, expect, it, vitest } from 'vitest'

import { ensureNeededBinariesExist } from '..'

describe('ensureNeededBinariesExist', () => {
  describe('clientEngineType = client', () => {
    it('when previewFeatures = [], should download library query engine', async () => {
      const download = vitest.fn()
      await ensureNeededBinariesExist({
        clientEngineType: 'client',
        previewFeatures: [],
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

    it('when previewFeatures = ["queryCompiler"], should not download query engine', async () => {
      const download = vitest.fn()
      await ensureNeededBinariesExist({
        clientEngineType: 'client',
        previewFeatures: ['queryCompiler'],
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
    it('when previewFeatures = [], should download library query engine', async () => {
      const download = vitest.fn()
      await ensureNeededBinariesExist({
        clientEngineType: 'library',
        previewFeatures: [],
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

    it('when previewFeatures = ["queryCompiler"], should download library query engine', async () => {
      const download = vitest.fn()
      await ensureNeededBinariesExist({
        clientEngineType: 'library',
        previewFeatures: ['queryCompiler'],
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
    it('when previewFeatures = [], should download binary query engine', async () => {
      const download = vitest.fn()
      await ensureNeededBinariesExist({
        clientEngineType: 'binary',
        previewFeatures: [],
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

    it('when previewFeatures = ["queryCompiler"], should download binary query engine', async () => {
      const download = vitest.fn()
      await ensureNeededBinariesExist({
        clientEngineType: 'binary',
        previewFeatures: ['queryCompiler'],
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
