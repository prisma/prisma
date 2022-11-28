import { Cache } from '../../../generation/Cache'
import { lazyProperty } from '../../../generation/lazyProperty'
import { dmmfToJSModelName } from '../model/utils/dmmfToJSModelName'
import { Args, ClientExtensionDefinition, ModelExtensionDefinition, QueryOptionsCb } from './$extends'
import { ComputedFieldsMap, getComputedFields } from './resultUtils'

class MergedExtensionsListNode {
  private computedFieldsCache = new Cache<string, ComputedFieldsMap | undefined>()
  private modelExtensionsCache = new Cache<string, ModelExtensionDefinition | undefined>()
  private queryCallbacksCache = new Cache<string, QueryOptionsCb[]>()

  private clientExtensions = lazyProperty(() => {
    if (!this.extension.client) {
      return this.previous?.getAllClientExtensions()
    }

    return {
      ...this.previous?.getAllClientExtensions(),
      ...this.extension.client,
    }
  })

  constructor(public extension: Args, public previous?: MergedExtensionsListNode) {}

  getAllComputedFields(dmmfModelName: string): ComputedFieldsMap | undefined {
    return this.computedFieldsCache.getOrCreate(dmmfModelName, () => {
      return getComputedFields(this.previous?.getAllComputedFields(dmmfModelName), this.extension, dmmfModelName)
    })
  }

  getAllClientExtensions(): ClientExtensionDefinition | undefined {
    return this.clientExtensions.get()
  }

  getAllModelExtensions(dmmfModelName: string): ModelExtensionDefinition | undefined {
    return this.modelExtensionsCache.getOrCreate(dmmfModelName, () => {
      const jsModelName = dmmfToJSModelName(dmmfModelName)
      if (!this.extension.model || !(this.extension.model[jsModelName] || this.extension.model.$allModels)) {
        return this.previous?.getAllModelExtensions(dmmfModelName)
      }

      return {
        ...this.previous?.getAllModelExtensions(dmmfModelName),
        ...this.extension.model.$allModels,
        ...this.extension.model[jsModelName],
      }
    })
  }

  getAllQueryCallbacks(jsModelName: string, action: string) {
    return this.queryCallbacksCache.getOrCreate(`${jsModelName}:${action}`, () => {
      const previous = this.previous?.getAllQueryCallbacks(jsModelName, action) ?? []
      const query = this.extension.query
      if (!query || !(query[jsModelName] || query.$allModels)) {
        return previous
      }

      const newCallbacks: QueryOptionsCb[] = []

      if (query[jsModelName] !== undefined) {
        if (query[jsModelName][action] !== undefined) {
          newCallbacks.push(query[jsModelName][action])
        }

        // when the model-bound extension has a wildcard for the operation
        if (query[jsModelName]['$allOperations'] !== undefined) {
          newCallbacks.push(query[jsModelName]['$allOperations'])
        }
      }

      // when the extension isn't model-bound, apply it to all models
      if (query['$allModels'] !== undefined) {
        if (query['$allModels'][action] !== undefined) {
          newCallbacks.push(query['$allModels'][action])
        }

        // when the non-model-bound extension has a wildcard for the operation
        if (query['$allModels']['$allOperations'] !== undefined) {
          newCallbacks.push(query['$allModels']['$allOperations'])
        }
      }
      return previous.concat(newCallbacks)
    })
  }
}

export class MergedExtensionsList {
  private constructor(private head?: MergedExtensionsListNode) {}

  static empty() {
    return new MergedExtensionsList()
  }

  static single(extension: Args) {
    return new MergedExtensionsList(new MergedExtensionsListNode(extension))
  }

  isEmpty(): boolean {
    return this.head === undefined
  }

  append(extension: Args) {
    return new MergedExtensionsList(new MergedExtensionsListNode(extension, this.head))
  }

  getAllComputedFields(dmmfModelName: string): ComputedFieldsMap | undefined {
    return this.head?.getAllComputedFields(dmmfModelName)
  }

  getAllClientExtensions() {
    return this.head?.getAllClientExtensions()
  }

  getAllModelExtensions(dmmfModelName: string) {
    return this.head?.getAllModelExtensions(dmmfModelName)
  }

  getAllQueryCallbacks(jsModelName: string, action: string) {
    return this.head?.getAllQueryCallbacks(jsModelName, action) ?? []
  }
}
