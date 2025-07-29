import { enginesVersion } from '@prisma/engines'

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
        rustStackTrace,
        cliVersion,
      }),
    )
  })
})
