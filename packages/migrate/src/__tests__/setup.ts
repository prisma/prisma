const originalEnv = process.env
const originalCwd = process.cwd()

beforeEach(() => {
  process.chdir(originalCwd)
  process.env = { ...originalEnv }
  // To avoid the loading spinner prints in local cli output snapshot tests
  process.env.CI = 'true'
})

afterEach(() => {
  process.chdir(originalCwd)
  process.env = { ...originalEnv }
})
