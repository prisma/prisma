import { expect, test } from 'vitest'

import { rethrowAsUserFacing } from './user-facing-error'

function makeDriverAdapterError(cause: object) {
  // Minimal shape that satisfies isDriverAdapterError + rethrowAsUserFacing
  return {
    name: 'DriverAdapterError',
    message: 'driver adapter error',
    cause,
  }
}

test('rethrowAsUserFacing re-throws the original error for unknown cause kinds', () => {
  // An unknown `kind` value simulates a driver-adapter version that is ahead
  // of the client (new error variant not yet handled by getErrorCode /
  // renderErrorMessage). Before the fix the thrown message contained
  // "[object Object]"; after the fix it contains a JSON-serialised snapshot.
  const error = makeDriverAdapterError({ kind: 'SomeNewUnknownErrorKind', detail: 'more info' })

  expect(() => rethrowAsUserFacing(error)).toThrowError(/Unknown error: .*SomeNewUnknownErrorKind/)

  // Crucially the message must NOT degrade to the useless "[object Object]"
  expect(() => rethrowAsUserFacing(error)).not.toThrowError('[object Object]')
})
