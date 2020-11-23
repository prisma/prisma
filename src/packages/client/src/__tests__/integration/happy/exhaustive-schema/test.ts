import { generateTestClient } from '../../../../utils/getTestClient'
import fs from 'fs'
import path from 'path'

test('exhaustive-schema', async () => {
  await generateTestClient()

  const generatedTypeScript = fs.readFileSync(path.join(__dirname, './node_modules/.prisma/client/index.d.ts'), 'utf-8')
  const generatedJS = fs.readFileSync(path.join(__dirname, './node_modules/.prisma/client/index.js'), 'utf-8')
  const generatedBrowserJS = fs.readFileSync(path.join(__dirname, './node_modules/.prisma/client/index-browser.js'), 'utf-8')

  expect(generatedTypeScript).toMatchSnapshot('generatedTypeScript')
  expect(generatedJS).toMatchSnapshot('generatedJS')
  expect(generatedBrowserJS).toMatchSnapshot('generatedBrowserJS')

})
