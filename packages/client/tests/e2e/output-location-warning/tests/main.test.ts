import { $ } from 'zx'

const WARNING_GENERATE = 'Make it a dependency of your project'
const WARNING_IMPORT = 'Add your client as a `db` dependency to `package.json` and import it as a dependency instead'

describe('at custom location', () => {
  test('shows warning on generate', async () => {
    const { stdout } = await $`pnpm prisma generate --schema prisma/schema-custom.prisma`

    expect(stdout).toContain(WARNING_GENERATE)
  })

  test('shows warning on common.js import', async () => {
    const { stderr } = await $`node src/common-js-custom.js`
    expect(stderr).toContain(WARNING_IMPORT)
  })

  test('shows warning on common.js import via index.js', async () => {
    const { stderr } = await $`node src/common-js-custom-index.js`
    expect(stderr).toContain(WARNING_IMPORT)
  })

  test('does not shows warning on common.js edge import', async () => {
    const { stderr } = await $`node src/common-js-custom-edge.js`
    expect(stderr).not.toContain(WARNING_IMPORT)
  })

  test('does not shows warning on ESM edge import', async () => {
    const { stderr } = await $`node src/esm-custom-edge.mjs`
    expect(stderr).not.toContain(WARNING_IMPORT)
  })
})

describe('at default location', () => {
  test('does not show warning on generate', async () => {
    const { stdout } = await $`pnpm prisma generate --schema prisma/schema-default.prisma`

    expect(stdout).not.toContain(WARNING_GENERATE)
  })

  test('does not show warning on common.js import', async () => {
    const { stderr } = await $`node src/common-js-default.js`
    expect(stderr).not.toContain(WARNING_IMPORT)
  })

  test('does not show warning on common.js import via index.js', async () => {
    const { stderr } = await $`node src/common-js-default-index.js`
    expect(stderr).not.toContain(WARNING_IMPORT)
  })

  test('does not show warning on common.js edge import', async () => {
    const { stderr } = await $`node src/common-js-default-edge.js`
    expect(stderr).not.toContain(WARNING_IMPORT)
  })

  test('does not show warning on ESM import', async () => {
    const { stderr } = await $`node src/esm-default.mjs`
    expect(stderr).not.toContain(WARNING_IMPORT)
  })

  test('does not show warning on ESM import via index.js', async () => {
    const { stderr } = await $`node src/esm-default-index.mjs`
    expect(stderr).not.toContain(WARNING_IMPORT)
  })

  test('does not show warning on ESM edge import', async () => {
    const { stderr } = await $`node src/esm-default-edge.mjs`
    expect(stderr).not.toContain(WARNING_IMPORT)
  })
})
