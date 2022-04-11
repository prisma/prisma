import { enginesVersion } from '@prisma/engines'
import fs from 'fs'

import { ErrorArea, RustPanic } from '../panic'
import * as sendPanicUtils from '../sendPanic'

describe('sendPanic should fail when the error report creation fails', () => {
  const createErrorReportTag = 'error-report-creation-failed'
  const cliVersion = 'test-cli-version'
  const rustStackTrace = 'test-rustStack'

  let spyCreateErrorReport: jest.SpyInstance<Promise<string>, [data: sendPanicUtils.CreateErrorReportInput]>

  beforeEach(() => {
    spyCreateErrorReport = jest
      .spyOn(sendPanicUtils, 'createErrorReport')
      .mockImplementation(() => Promise.reject(new Error(createErrorReportTag)))
  })

  afterEach(() => {
    spyCreateErrorReport.mockRestore()
  })

  test("shouldn't mask any schema if no valid schema appears in RustPanic", async () => {
    const rustPanic = new RustPanic(
      'test-message',
      rustStackTrace,
      'test-request',
      ErrorArea.INTROSPECTION_CLI, // area
      undefined, // schemaPath
      undefined, // schema
      undefined, // introspectionUrl
    )

    await expect(sendPanicUtils.sendPanic(rustPanic, cliVersion, enginesVersion)).rejects.toThrowError(
      createErrorReportTag,
    )
    expect(spyCreateErrorReport).toHaveBeenCalledTimes(1)
    expect(spyCreateErrorReport.mock.calls[0][0]).toMatchObject({
      schemaFile: undefined,
      rustStackTrace,
      cliVersion,
    })
  })

  test('should mask the schema if a valid schemaPath appears in RustPanic', async () => {
    const schemaPath = 'src/__tests__/__fixtures__/blog-masked.prisma'
    const maskedSchema = fs.readFileSync(schemaPath, 'utf-8')

    const rustPanic = new RustPanic(
      'test-message',
      rustStackTrace,
      'test-request',
      ErrorArea.INTROSPECTION_CLI, // area
      schemaPath,
      undefined, // schema
      undefined, // introspectionUrl
    )

    await expect(sendPanicUtils.sendPanic(rustPanic, cliVersion, enginesVersion)).rejects.toThrowError(
      createErrorReportTag,
    )
    expect(spyCreateErrorReport).toHaveBeenCalledTimes(1)
    expect(spyCreateErrorReport.mock.calls[0][0]).toMatchObject({
      schemaFile: maskedSchema,
      rustStackTrace,
      cliVersion,
    })
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
      ErrorArea.INTROSPECTION_CLI, // area
      undefined, // schemaPath
      schema,
      undefined, // introspectionUrl
    )

    await expect(sendPanicUtils.sendPanic(rustPanic, cliVersion, enginesVersion)).rejects.toThrowError(
      createErrorReportTag,
    )
    expect(spyCreateErrorReport).toHaveBeenCalledTimes(1)
    expect(spyCreateErrorReport.mock.calls[0][0]).toMatchObject({
      schemaFile: maskedSchema,
      rustStackTrace,
      cliVersion,
    })
  })
})
