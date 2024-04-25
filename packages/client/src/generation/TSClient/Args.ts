import { DMMF } from '../dmmf-types'
import * as ts from '../ts-builders'
import {
  extArgsParam,
  getIncludeName,
  getLegacyModelArgName,
  getModelArgName,
  getOmitName,
  getSelectName,
} from '../utils'
import { GenerateContext } from './GenerateContext'
import { getArgFieldJSDoc } from './helpers'
import { buildInputField } from './Input'

export class ArgsTypeBuilder {
  private moduleExport: ts.Export<ts.TypeDeclaration<ts.ObjectType>>

  private hasDefaultName = true

  constructor(
    private readonly type: DMMF.OutputType,
    private readonly context: GenerateContext,
    private readonly action?: DMMF.ModelAction,
  ) {
    this.moduleExport = ts
      .moduleExport(
        ts.typeDeclaration(getModelArgName(type.name, action), ts.objectType()).addGenericParameter(extArgsParam),
      )
      .setDocComment(ts.docComment(`${type.name} ${action ?? 'without action'}`))
  }

  private addProperty(prop: ts.Property) {
    this.moduleExport.declaration.type.add(prop)
  }

  addSchemaArgs(args: readonly DMMF.SchemaArg[]): this {
    for (const arg of args) {
      const inputField = buildInputField(arg, this.context.genericArgsInfo)

      const docComment = getArgFieldJSDoc(this.type, this.action, arg)
      if (docComment) {
        inputField.setDocComment(ts.docComment(docComment))
      }
      this.addProperty(inputField)
    }
    return this
  }

  addSelectArg(): this {
    this.addProperty(
      ts
        .property(
          'select',
          ts.unionType([
            ts.namedType(getSelectName(this.type.name)).addGenericArgument(extArgsParam.toArgument()),
            ts.nullType,
          ]),
        )
        .optional()
        .setDocComment(ts.docComment(`Select specific fields to fetch from the ${this.type.name}`)),
    )

    return this
  }

  addIncludeArgIfHasRelations(): this {
    const hasRelationField = this.type.fields.some((f) => f.outputType.location === 'outputObjectTypes')
    if (!hasRelationField) {
      return this
    }

    this.addProperty(
      ts
        .property(
          'include',
          ts.unionType([
            ts.namedType(getIncludeName(this.type.name)).addGenericArgument(extArgsParam.toArgument()),
            ts.nullType,
          ]),
        )
        .optional()
        .setDocComment(ts.docComment('Choose, which related nodes to fetch as well')),
    )

    return this
  }

  addOmitArg(): this {
    if (!this.context.isPreviewFeatureOn('omitApi')) {
      return this
    }
    this.addProperty(
      ts
        .property(
          'omit',
          ts.unionType([
            ts.namedType(getOmitName(this.type.name)).addGenericArgument(extArgsParam.toArgument()),
            ts.nullType,
          ]),
        )
        .optional()
        .setDocComment(ts.docComment(`Omit specific fields from the ${this.type.name}`)),
    )
    return this
  }

  setGeneratedName(name: string): this {
    this.hasDefaultName = false
    this.moduleExport.declaration.setName(name)
    return this
  }

  setComment(comment: string): this {
    this.moduleExport.setDocComment(ts.docComment(comment))
    return this
  }

  createExport() {
    if (!this.action && this.hasDefaultName) {
      this.context.defaultArgsAliases.addPossibleAlias(
        getModelArgName(this.type.name),
        getLegacyModelArgName(this.type.name),
      )
    }
    this.context.defaultArgsAliases.registerArgName(this.moduleExport.declaration.name)
    return this.moduleExport
  }
}
