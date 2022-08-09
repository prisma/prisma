import { getTracingConfig } from './getTracingConfig'

it('should return enabled=false when tracing preview is not set', () => {
  const response = getTracingConfig([])

  expect(response).toMatchObject({
    enabled: false,
  })
})

it('should return enabled=false global var is not set', () => {
  const response = getTracingConfig([])

  expect(response).toMatchObject({
    enabled: false,
  })
})

it('should return enabled=true when both are set', () => {
  // @ts-ignore
  global.PRISMA_INSTRUMENTATION = true

  const response = getTracingConfig(['tracing'])

  expect(response).toMatchObject({
    enabled: true,
  })
})
