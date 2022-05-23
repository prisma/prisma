import * as fs from 'fs'
import * as path from 'path'

import { tryLoadEnvs } from '../tryLoadEnvs'

type Opts = { conflictCheck: 'warn' | 'error' | 'none' }

describe('tryLoadEnvs', () => {
  describe('conflicting', () => {
    const rootEnvPath = path.join(__dirname, '_generated', `tryLoadEnvs_conflicting1.env`)
    const schemaEnvPath = path.join(__dirname, '_generated', `tryLoadEnvs_conflicting2.env`)
    const envContent1 = `
        SHOULD_THROW=initial_value
    `
    const envContent2 = `
        SHOULD_THROW=conflicting_value
    `

    beforeAll(async () => {
      await Promise.all([
        fs.promises.writeFile(rootEnvPath, envContent1),
        fs.promises.writeFile(schemaEnvPath, envContent2),
      ])
    })

    afterAll(async () => {
      await Promise.all([fs.promises.unlink(rootEnvPath), fs.promises.unlink(schemaEnvPath)])
    })

    test('should throw an error when envs are conflicting', () => {
      expect.assertions(2)
      const opts: Opts = { conflictCheck: 'error' }

      try {
        tryLoadEnvs({ rootEnvPath, schemaEnvPath }, opts)
      } catch (error) {
        expect(error.message).toContain(`Conflicting env vars:`)
        expect(error.message).toContain(`SHOULD_THROW`)
      }
    })
  })

  describe('duplicate', () => {
    const rootEnvPath = path.join(__dirname, '_generated', `tryLoadEnvs_warn1.env`)
    const schemaEnvPath = path.join(__dirname, '_generated', `tryLoadEnvs_warn2.env`)
    const envContent1 = `
        SHOULD_WARN=duplicate
    `
    const envContent2 = `
        SHOULD_WARN=duplicate
    `

    beforeAll(async () => {
      await Promise.all([
        fs.promises.writeFile(rootEnvPath, envContent1),
        fs.promises.writeFile(schemaEnvPath, envContent2),
      ])
    })

    afterAll(async () => {
      await Promise.all([fs.promises.unlink(rootEnvPath), fs.promises.unlink(schemaEnvPath)])
    })

    test('should warn when envs are duplicated', () => {
      expect.assertions(3)
      const opts: Opts = { conflictCheck: 'warn' }

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
      tryLoadEnvs({ rootEnvPath, schemaEnvPath }, opts)
      expect(consoleSpy).toBeCalled()

      const output = consoleSpy.mock.calls.join('\n')
      expect(output).toContain(`Conflict for env var`)
      expect(output).toContain(`SHOULD_WARN`)

      consoleSpy.mockRestore()
    })
  })

  describe('empty-strings', () => {
    const rootEnvPath = path.join(__dirname, '_generated', `tryLoadEnvs_empty-strings1.env`)
    const schemaEnvPath = path.join(__dirname, '_generated', `tryLoadEnvs_empty-strings2.env`)
    const envContent1 = `
        EMPTY_STRING=""
    `
    const envContent2 = `
        EMPTY_STRING=""
    `

    beforeAll(async () => {
      await Promise.all([
        fs.promises.writeFile(rootEnvPath, envContent1),
        fs.promises.writeFile(schemaEnvPath, envContent2),
      ])
    })

    afterAll(async () => {
      await Promise.all([fs.promises.unlink(rootEnvPath), fs.promises.unlink(schemaEnvPath)])
    })

    test('should warn when empty strings are duplicated', () => {
      expect.assertions(3)
      const opts: Opts = { conflictCheck: 'warn' }

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
      tryLoadEnvs({ rootEnvPath, schemaEnvPath }, opts)
      expect(consoleSpy).toBeCalled()

      const output = consoleSpy.mock.calls.join('\n')
      expect(output).toContain(`Conflict for env var`)
      expect(output).toContain(`EMPTY_STRING`)

      consoleSpy.mockRestore()
    })
  })
})
