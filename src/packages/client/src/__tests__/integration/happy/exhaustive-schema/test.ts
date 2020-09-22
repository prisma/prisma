import { generateTestClient } from '../../../../utils/getTestClient'
import fs from 'fs'
import path from 'path'

test('exhaustive-schema', async () => {
  await generateTestClient()

  const generatedTypeScript = fs.readFileSync(path.join(__dirname, './node_modules/.prisma/client/index.d.ts'), 'utf-8')
  expect(generatedTypeScript).toMatchSnapshot()
})
