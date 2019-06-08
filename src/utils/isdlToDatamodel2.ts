import { LiftEngine } from '../LiftEngine'
import { ISDL, isdlToDmmfDatamodel } from 'prisma-datamodel'

export async function isdlToDatamodel2(isdl: ISDL) {
  const engine = new LiftEngine({ projectDir: process.cwd() })
  const { dmmf, dataSources } = await isdlToDmmfDatamodel(isdl)

  const result = await engine.convertDmmfToDml({
    dmmf: JSON.stringify(dmmf),
    dataSources,
  })

  return result.datamodel
}
