import * as stackTraceParser from 'stacktrace-parser'

import { ErrorFormat } from '../getPrismaClient'

export type LocationInFile = {
  fileName: string
  lineNumber: number | null
  columnNumber: number | null
}

export interface CallSite {
  getLocation(): LocationInFile | null
}

class DisabledCallSite implements CallSite {
  getLocation(): LocationInFile | null {
    return null
  }
}

class EnabledCallSite implements CallSite {
  private _error: Error
  constructor() {
    this._error = new Error()
  }
  getLocation(): LocationInFile | null {
    const stack = this._error.stack
    if (!stack) {
      return null
    }
    const stackFrames = stackTraceParser.parse(stack)
    // TODO: more resilient logic to check that it's not relative to cwd
    const frame = stackFrames.find((t) => {
      // Here we are trying to find the location in the user's code which caused the error
      return (
        t.file &&
        t.file !== '<anonymous>' && // Ignore as we can not read an <anonymous> file
        !t.file.includes('@prisma') && // Internal, unbundled code
        !t.file.includes('getPrismaClient') &&
        !t.file.includes('runtime/binary') &&
        !t.file.includes('runtime/library') &&
        !t.file.includes('runtime/data-proxy') &&
        !t.file.startsWith('internal/') && // We don't want internal nodejs files
        !t.methodName.includes('new ') && // "new CallSite" call and maybe other constructors
        !t.methodName.includes('getCallSite') && // getCallSite function from this module
        !t.methodName.includes('Proxy.') && // Model proxies
        t.methodName.split('.').length < 4
      )
    })
    if (!frame || !frame.file) {
      return null
    }

    return {
      fileName: frame.file,
      lineNumber: frame.lineNumber,
      columnNumber: frame.column,
    }
  }
}

export function getCallSite(errorFormat: ErrorFormat): CallSite {
  if (errorFormat === 'minimal') {
    return new DisabledCallSite()
  }
  return new EnabledCallSite()
}
