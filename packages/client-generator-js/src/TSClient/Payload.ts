import { uncapitalize } from '@prisma/client-common'
import * as DMMF from '@prisma/dmmf'
import * as ts from '@prisma/ts-builders'

import { extArgsParam, getPayloadName } from '../utils'
import { GenerateContext } from './GenerateContext'
import { buildModelOutputProperty } from './Output'

export function buildModelPayload(model: DMMF.Model, context: GenerateContext) {
  const isComposite = context.dmmf.isComposite(model.name)

  const objects = ts.objectType()
  const scalars = ts.objectType()
  const composites = ts.objectType()

  for (const field of model.fields) {
    if (field.kind === 'object') {
      if (context.dmmf.isComposite(field.type)) {
        composites.add(buildModelOutputProperty(field, context.dmmf))
      } else {
        objects.add(buildModelOutputProperty(field, context.dmmf))
      }
    } else if (field.kind === 'enum' || field.kind === 'scalar') {
      scalars.add(buildModelOutputProperty(field, context.dmmf))
    }
  }

  const scalarsType = isComposite
    ? scalars
    : ts
        .namedType('$Extensions.GetPayloadResult')
        .addGenericArgument(scalars)
        .addGenericArgument(ts.namedType('ExtArgs').subKey('result').subKey(uncapitalize(model.name)))

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
