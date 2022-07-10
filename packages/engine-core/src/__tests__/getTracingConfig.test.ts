import { getTracingConfig } from '../common/utils/getTracingConfig'

describe('getTracingConfig', () => {
  test('should return enabled=false when tracing preview is not set', () => {
    // @ts-ignore
    const response = getTracingConfig({
      _hasPreviewFlag: () => false,
    })

    expect(response).toMatchObject({
      enabled: false,
    })
  })

  test('should return enabled=false global var is not set', () => {
    // @ts-ignore
    const response = getTracingConfig({
      _hasPreviewFlag: () => true,
    })

    expect(response).toMatchObject({
      enabled: false,
    })
  })

  test('should return enabled=true when both are set', () => {
    // @ts-ignore
    global.PRISMA_INSTRUMENTATION = true

    // @ts-ignore
    const response = getTracingConfig({
      _hasPreviewFlag: () => true,
    })

    expect(response).toMatchObject({
      enabled: true,
    })
  })
})
