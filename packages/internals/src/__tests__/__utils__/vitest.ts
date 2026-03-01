import { type MockInstance, test as vitest, vi } from 'vitest'

export const test = vitest.extend<{
  consoleMock: {
    info: MockInstance
    log: MockInstance
    warn: MockInstance
    error: MockInstance
  }
}>({
  // eslint-disable-next-line no-empty-pattern
  consoleMock: async ({}, use) => {
    const mocks = {
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    }
    await use(mocks)
    for (const m of Object.values(mocks)) {
      m.mockRestore()
    }
  },
})
