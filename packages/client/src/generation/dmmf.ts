import type { DMMF } from '@prisma/generator-helper'

import type { Dictionary } from './utils/common'
import { keyBy } from './utils/common'

export { datamodelEnumToSchemaEnum } from '@prisma/generator-helper'

type NamespacedTypeMap<T> = {
  prisma: Record<string, T>
  model: Record<string, T>
}

type FullyQualifiedName = string & { readonly _brand: unique symbol }

export class DMMFHelper implements DMMF.Document {
  private _compositeNames?: Set<string>
  private _inputTypesByName?: Map<FullyQualifiedName, DMMF.InputType>
  private _typeAndModelMap?: Dictionary<DMMF.Model>
  private _mappingsMap?: Dictionary<DMMF.ModelMapping>
  private _outputTypeMap?: NamespacedTypeMap<DMMF.OutputType>
  private _rootFieldMap?: Dictionary<DMMF.SchemaField>

  constructor(public document: DMMF.Document) {}

  private get compositeNames(): Set<string> {
    return (this._compositeNames ??= new Set(this.datamodel.types.map((t) => t.name)))
  }

  private get inputTypesByName(): Map<FullyQualifiedName, DMMF.InputType> {
    return (this._inputTypesByName ??= this.buildInputTypesMap())
  }

  get typeAndModelMap(): Dictionary<DMMF.Model> {
    return (this._typeAndModelMap ??= this.buildTypeModelMap())
  }

  get mappingsMap(): Dictionary<DMMF.ModelMapping> {
    return (this._mappingsMap ??= this.buildMappingsMap())
  }

  get outputTypeMap(): NamespacedTypeMap<DMMF.OutputType> {
    return (this._outputTypeMap ??= this.buildMergedOutputTypeMap())
  }

  get rootFieldMap(): Dictionary<DMMF.SchemaField> {
    return (this._rootFieldMap ??= this.buildRootFieldMap())
  }

  get datamodel(): DMMF.Datamodel {
    return this.document.datamodel
  }

  get mappings(): DMMF.Mappings {
    return this.document.mappings
  }

  get schema(): DMMF.Schema {
    return this.document.schema
  }

  get inputObjectTypes(): DMMF.Schema['inputObjectTypes'] {
    return this.schema.inputObjectTypes
  }

  get outputObjectTypes(): DMMF.Schema['outputObjectTypes'] {
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
    if (!this.schema.outputObjectTypes.prisma) {
      return {
        model: keyBy(this.schema.outputObjectTypes.model, 'name'),
        prisma: keyBy([], 'name'),
      }
    }

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
