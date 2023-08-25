import { Cache } from './Cache'
import { DMMFHelper } from './dmmf'
import { DMMF } from './dmmf-types'

type ToVisitItem = {
  key: string
  type: DMMF.InputType
  parent?: ToVisitItem
}

export class GenericArgsInfo {
  private _cache = new Cache<string, boolean>()

  constructor(private _dmmf: DMMFHelper) {}

  /**
   * Determines if arg types need generic <$PrismaModel> argument added.
   * Essentially, performs breadth-first search for any fieldRefTypes that
   * do not have corresponding `meta.source` defined.
   *
   * @param type
   * @returns
   */
  typeNeedsGenericModelArg(topLevelType: DMMF.InputType, namespace?: DMMF.FieldNamespace | undefined): boolean {
    const topLevelKey = getTypeKey(topLevelType, namespace)

    return this._cache.getOrCreate(topLevelKey, () => {
      const toVisit: ToVisitItem[] = [{ key: topLevelKey, type: topLevelType }]
      const visited = new Set<string>()

      let item: ToVisitItem | undefined
      while ((item = toVisit.shift())) {
        const { type: currentType, key } = item
        const cached = this._cache.get(key)
        if (cached === true) {
          this._cacheResultsForTree(item)
          return true
        }

        if (cached === false) {
          continue
        }

        if (visited.has(key)) {
          // if we have a loop, outcome is determined by other keys
          continue
        }

        if (currentType.meta?.source) {
          // if source is defined, we know model for sure and do not need generic argument
          this._cache.set(key, false)
          continue
        }

        visited.add(key)

        for (const field of currentType.fields) {
          for (const fieldType of field.inputTypes) {
            if (fieldType.location === 'fieldRefTypes') {
              this._cacheResultsForTree(item)
              return true
            }

            const inputObject = this._dmmf.resolveInputObjectType(fieldType)
            if (inputObject) {
              toVisit.push({ key: getTypeKey(inputObject, fieldType.namespace), type: inputObject, parent: item })
            }
          }
        }
      }

      // if we reached this point then none of the types we have visited so far require generic type

      for (const visitedKey of visited) {
        this._cache.set(visitedKey, false)
      }

      return false
    })
  }

  typeRefNeedsGenericModelArg(ref: DMMF.InputTypeRef) {
    if (ref.location === 'fieldRefTypes') {
      return true
    }
    const inputType = this._dmmf.resolveInputObjectType(ref)
    if (!inputType) {
      return
    }
    return this.typeNeedsGenericModelArg(inputType, ref.namespace)
  }

  private _cacheResultsForTree(item: ToVisitItem): void {
    let currentItem: ToVisitItem | undefined = item
    while (currentItem) {
      this._cache.set(currentItem.key, true)
      currentItem = currentItem.parent
    }
  }
}

function getTypeKey(type: DMMF.InputType, namespace: DMMF.FieldNamespace | undefined) {
  const parts: string[] = []
  if (namespace) {
    parts.push(namespace)
  }
  parts.push(type.name)
  return parts.join('.')
}
