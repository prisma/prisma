import { DMMFHelper } from '../dmmf'
import { DMMF } from '../dmmf-types'
import * as ts from '../ts-builders'
import { extArgsParam, getPayloadName } from '../utils'
import { lowerCase } from '../utils/common'
import { buildModelOutputProperty } from './Output'

export function buildModelPayload(model: DMMF.Model, dmmf: DMMFHelper) {
  const isComposite = dmmf.isComposite(model.name)

  const objects = ts.objectType()
  const scalars = ts.objectType()
  const composites = ts.objectType()

  for (const field of model.fields) {
    if (field.kind === 'object') {
      if (dmmf.isComposite(field.type)) {
        composites.add(buildModelOutputProperty(field, dmmf))
      } else {
        objects.add(buildModelOutputProperty(field, dmmf))
      }
    } else if (field.kind === 'enum' || field.kind === 'scalar') {
      scalars.add(buildModelOutputProperty(field, dmmf))
    }
  }

  const scalarsType = isComposite
    ? scalars
    : ts
        .namedType('$Extensions.GetPayloadResult')
        .addGenericArgument(scalars)
        .addGenericArgument(ts.namedType('ExtArgs').subKey('result').subKey(lowerCase(model.name)))

  const payloadTypeDeclaration = ts.typeDeclaration(
    getPayloadName(model.name, false),
    ts
      .objectType()
      .add(ts.property('name', ts.stringLiteral(model.name)))
      .add(ts.property('objects', objects))
      .add(ts.property('scalars', scalarsType))
      .add(ts.property('composites', composites)),
  )

  if (!isComposite) {
    payloadTypeDeclaration.addGenericParameter(extArgsParam)
  }

  return ts.moduleExport(payloadTypeDeclaration)
}
