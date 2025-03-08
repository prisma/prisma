import { enginesVersion } from '@prisma/engines'
import fs from 'node:fs'

import { createErrorReport } from '../errorReporting'
import { ErrorArea, RustPanic } from '../panic'
import { sendPanic } from '../sendPanic'

const createErrorReportTag = 'error-report-creation-failed'

jest.mock('../errorReporting', () => ({
  ...jest.requireActual('../errorReporting'),
  createErrorReport: jest.fn().mockImplementation(() => Promise.reject(new Error(createErrorReportTag))),
}))

describe('sendPanic should fail when the error report creation fails', () => {
  const cliVersion = 'test-cli-version'
  const rustStackTrace = 'test-rustStack'

  // mock for retrieving the database version
  const getDatabaseVersionSafe = () => Promise.resolve(undefined)

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("shouldn't mask any schema if no valid schema appears in RustPanic", async () => {
    const rustPanic = new RustPanic(
      'test-message',
      rustStackTrace,
      'test-request',
      ErrorArea.LIFT_CLI, // area
      undefined, // schemaPath
      undefined, // schema
      undefined, // introspectionUrl
    )

    await expect(
      sendPanic({
        error: rustPanic,
        cliVersion,
        enginesVersion,
        getDatabaseVersionSafe,
      }),
    ).rejects.toThrow(createErrorReportTag)
    expect(createErrorReport).toHaveBeenCalledTimes(1)
    expect(createErrorReport).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaFile: undefined,
        rustStackTrace,
        cliVersion,
      }),
    )
  })

  test('should mask the schema if a valid schemaPath appears in RustPanic', async () => {
    const schemaPath = 'src/__tests__/__fixtures__/blog.prisma'
    const expectedMaskedSchema = fs.readFileSync('src/__tests__/__fixtures__/blog-masked.prisma', 'utf-8')

    const rustPanic = new RustPanic(
      'test-message',
      rustStackTrace,
      'test-request',
      ErrorArea.LIFT_CLI, // area
      schemaPath,
      undefined, // schema
      undefined, // introspectionUrl
    )

    await expect(
      sendPanic({
        error: rustPanic,
        cliVersion,
        enginesVersion,
        getDatabaseVersionSafe,
      }),
    ).rejects.toThrow(createErrorReportTag)
    expect(createErrorReport).toHaveBeenCalledTimes(1)
    expect(createErrorReport).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaFile: expect.stringContaining(expectedMaskedSchema),
        rustStackTrace,
        cliVersion,
      }),
    )
  })

  test('should mask the schema if a valid schema appears in RustPanic', async () => {
    const schema = `
datasource db {
  provider = "sqlite"
  url      = "file:dev.db"
}
    `
    const maskedSchema = `
datasource db {
  provider = "sqlite"
  url = "***"
}
    `

    const rustPanic = new RustPanic(
      'test-message',
      rustStackTrace,
      'test-request',
      ErrorArea.LIFT_CLI, // area
      undefined, // schemaPath
      [['schema.prisma', schema]],
      undefined, // introspectionUrl
    )

    await expect(
      sendPanic({
        error: rustPanic,
        cliVersion,
        enginesVersion,
        getDatabaseVersionSafe,
      }),
    ).rejects.toThrow(createErrorReportTag)
    expect(createErrorReport).toHaveBeenCalledTimes(1)
    expect(createErrorReport).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaFile: expect.stringContaining(maskedSchema),
        rustStackTrace,
        cliVersion,
      }),
    )
  })
})
