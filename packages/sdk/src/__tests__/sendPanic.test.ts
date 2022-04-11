import { enginesVersion } from '@prisma/engines'

import { ErrorArea, RustPanic } from '../panic'
import * as sendPanicUtils from '../sendPanic'

describe('sendPanic', () => {
  const cliVersion = 'test-cli-version'

  test('should fail when the error report creation fails:', async () => {
    const errorTag = 'error-report-creation-failed'
    const spy = jest
      .spyOn(sendPanicUtils, 'createErrorReport')
      .mockImplementation(() => Promise.reject(new Error(errorTag)))

    const rustPanic = new RustPanic(
      'test-message',
      'test-rustStack',
      'test-request',
      ErrorArea.INTROSPECTION_CLI, // area
      undefined, // schemaPath
      undefined, // schema
      undefined, // introspectionUrl
    )

    await expect(sendPanicUtils.sendPanic(rustPanic, cliVersion, enginesVersion)).rejects.toThrowError(errorTag)
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
})
