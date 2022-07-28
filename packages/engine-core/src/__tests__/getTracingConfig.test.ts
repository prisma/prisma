import { getTracingConfig } from '../../../client/src/runtime/core/tracing/getTracingConfig'

describe('getTracingConfig', () => {
  test('should return enabled=false when tracing preview is not set', () => {
    const stub = {
      _hasPreviewFlag: () => false,
    }

    // @ts-ignore - Its a stub
    const response = getTracingConfig(stub)

    expect(response).toMatchObject({
      enabled: false,
    })
  })

  test('should return enabled=false global var is not set', () => {
    const stub = {
      _hasPreviewFlag: () => true,
    }

    // @ts-ignore - Its a stub
    const response = getTracingConfig(stub)

    expect(response).toMatchObject({
      enabled: false,
    })
  })

  test('should return enabled=true when both are set', () => {
    // @ts-ignore
    global.PRISMA_INSTRUMENTATION = true

    const stub = {
      _hasPreviewFlag: () => true,
    }

    // @ts-ignore - Its a stub
    const response = getTracingConfig(stub)

    expect(response).toMatchObject({
      enabled: true,
    })
  })
})
