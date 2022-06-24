import fs from 'fs'
import path from 'path'

import { getDMMF } from '../../../../generation/getDMMF'
import { compileFile } from '../../../../utils/compileFile'

const isMacOrWindowsCI = Boolean(process.env.CI) && ['darwin', 'win32'].includes(process.platform)
if (isMacOrWindowsCI) {
  jest.setTimeout(80_000)
}

const testIf = (condition: boolean) => (condition ? test : test.skip)

/**
 * Makes sure, that the actual dmmf value and types are in match
 */
testIf(process.platform !== 'win32')('dmmf-types', async () => {
  const datamodel = fs.readFileSync(path.join(__dirname, 'schema.prisma'), 'utf-8')
  const dmmf = await getDMMF({
    datamodel,
  })
  const dmmfFile = path.join(__dirname, 'generated-dmmf.ts')

  fs.writeFileSync(
    dmmfFile,
    `import { DMMF } from '@prisma/generator-helper'

  const dmmf: DMMF.Document = ${JSON.stringify(dmmf, null, 2)}`,
  )

  await expect(compileFile(dmmfFile)).resolves.not.toThrow()
})
