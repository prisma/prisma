import fs from 'fs'
import path from 'path'

import { getDMMF } from '../../../../generation/getDMMF'
import { compileFile } from '../../../../utils/compileFile'

/**
 * Makes sure, that the actual dmmf value and types are in match
 */
test('dmmf-types', async () => {
  const datamodel = await fs.promises.readFile(path.join(__dirname, 'schema.prisma'), 'utf-8')
  const dmmf = await getDMMF({
    datamodel,
  })
  const dmmfFile = path.join(__dirname, 'generated-dmmf.ts')

  await fs.promises.writeFile(
    dmmfFile,
    `import { DMMF } from '@prisma/generator-helper'

  const dmmf: DMMF.Document = ${JSON.stringify(dmmf, null, 2)}`,
  )

  await expect(compileFile(dmmfFile)).resolves.not.toThrow()
})
