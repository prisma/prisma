import fs from 'fs'
import path from 'path'

import { generateTestClient } from '../../../../utils/getTestClient'

const isMacOrWindowsCI = Boolean(process.env.CI) && ['darwin', 'win32'].includes(process.platform)
if (isMacOrWindowsCI) {
  jest.setTimeout(80_000)
}

test('exhaustive-schema', async () => {
  await generateTestClient()

  const generatedTypeScript = fs.readFileSync(path.join(__dirname, './node_modules/.prisma/client/index.d.ts'), 'utf-8')
  const generatedBrowserJS = fs.readFileSync(
    path.join(__dirname, './node_modules/.prisma/client/index-browser.js'),
    'utf-8',
  )

  expect(sanitizeRuntimeImport(generatedTypeScript)).toMatchSnapshot('generatedTypeScript')
  expect(sanitizeRuntimeImport(generatedBrowserJS)).toMatchSnapshot('generatedBrowserJS')
})

function sanitizeRuntimeImport(source: string): string {
  return source.replace(/@prisma\/client\/runtime\/(library|binary)/g, '@prisma/client/runtime/{RUNTIME_FILE}')
}
