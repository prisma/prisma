import type { DMMF } from '@prisma/generator-helper'

import type { Dictionary } from './utils/common'
import { keyBy } from './utils/common'

type NamespacedTypeMap<T> = {
  prisma: Record<string, T>
  model: Record<string, T>
}

type FullyQualifiedName = string & { readonly _brand: unique symbol }

export class DMMFHelper implements DMMF.Document {
  private compositeNames: Set<string>
  private inputTypesByName: Map<FullyQualifiedName, DMMF.InputType>
  readonly typeAndModelMap: Dictionary<DMMF.Model>
  readonly mappingsMap: Dictionary<DMMF.ModelMapping>
  readonly outputTypeMap: NamespacedTypeMap<DMMF.OutputType>
  readonly rootFieldMap: Dictionary<DMMF.SchemaField>

  constructor(public document: DMMF.Document) {
    this.compositeNames = new Set(this.datamodel.types.map((t) => t.name))
    this.typeAndModelMap = this.buildTypeModelMap()
    this.mappingsMap = this.buildMappingsMap()
    this.outputTypeMap = this.buildMergedOutputTypeMap()
    this.rootFieldMap = this.buildRootFieldMap()
    this.inputTypesByName = this.buildInputTypesMap()
  }

  get datamodel() {
    return this.document.datamodel
  }

  get mappings() {
    return this.document.mappings
  }

  get schema() {
    return this.document.schema
  }

  get inputObjectTypes() {
    return this.schema.inputObjectTypes
  }

  get outputObjectTypes() {
    return this.schema.outputObjectTypes
  }

  isComposite(modelOrTypeName: string) {
    return this.compositeNames.has(modelOrTypeName)
  }

  getOtherOperationNames() {
    return [
      Object.values(this.mappings.otherOperations.write),
      Object.values(this.mappings.otherOperations.read),
    ].flat()
  }

  hasEnumInNamespace(enumName: string, namespace: DMMF.FieldNamespace): boolean {
    return this.schema.enumTypes[namespace]?.find((schemaEnum) => schemaEnum.name === enumName) !== undefined
  }

  resolveInputObjectType(ref: DMMF.InputTypeRef): DMMF.InputType | undefined {
    return this.inputTypesByName.get(fullyQualifiedName(ref.type, ref.namespace))
  }

  resolveOutputObjectType(ref: DMMF.OutputTypeRef): DMMF.OutputType | undefined {
    if (ref.location !== 'outputObjectTypes') {
      return undefined
    }
    return this.outputObjectTypes[ref.namespace ?? 'prisma'].find((outputObject) => outputObject.name === ref.type)
  }

  private buildModelMap(): Dictionary<DMMF.Model> {
    return keyBy(this.datamodel.models, 'name')
  }

  private buildTypeMap(): Dictionary<DMMF.Model> {
    return keyBy(this.datamodel.types, 'name')
  }

  private buildTypeModelMap(): Dictionary<DMMF.Model> {
    return { ...this.buildTypeMap(), ...this.buildModelMap() }
  }

  private buildMappingsMap(): Dictionary<DMMF.ModelMapping> {
    return keyBy(this.mappings.modelOperations, 'model')
  }

  private buildMergedOutputTypeMap(): NamespacedTypeMap<DMMF.OutputType> {
    return {
      model: keyBy(this.schema.outputObjectTypes.model, 'name'),
      prisma: keyBy(this.schema.outputObjectTypes.prisma, 'name'),
    }
  }

  private buildRootFieldMap(): Dictionary<DMMF.SchemaField> {
    return {
      ...keyBy(this.outputTypeMap.prisma.Query.fields, 'name'),
      ...keyBy(this.outputTypeMap.prisma.Mutation.fields, 'name'),
    }
  }

  private buildInputTypesMap() {
    const result = new Map<FullyQualifiedName, DMMF.InputType>()
    for (const type of this.inputObjectTypes.prisma) {
      result.set(fullyQualifiedName(type.name, 'prisma'), type)
    }

    if (!this.inputObjectTypes.model) {
      return result
    }

    for (const type of this.inputObjectTypes.model) {
      result.set(fullyQualifiedName(type.name, 'model'), type)
    }
    return result
  }
}

function fullyQualifiedName(typeName: string, namespace?: string) {
  if (namespace) {
    return `${namespace}.${typeName}` as FullyQualifiedName
  }
  return typeName as FullyQualifiedName
}
