import { DMMF } from '../runtime/dmmf-types'
import { Cache } from './Cache'
import { getType } from './utils'

type ToVisitItem = {
  key: string
  type: DMMF.SchemaArgInputType
  parent?: ToVisitItem
}

export class GenericArgsInfo {
  private _cache = new Cache<string, boolean>()

  /**
   * Determines if arg types need generic <$PrismaModel> argument added.
   * Essentially, performs breadth-first search for any fieldRefTypes that
   * do not have corresponding `meta.source` defined.
   *
   * @param type
   * @returns
   */
  needsGenericModelArg(topLevelType: DMMF.SchemaArgInputType): boolean {
    const topLevelKey = getTypeKey(topLevelType)

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
          continue
        }

        visited.add(key)

        if (currentType.location === 'fieldRefTypes') {
          this._cacheResultsForTree(item)
          return true
        }

        if (currentType.location === 'inputObjectTypes' && typeof currentType.type === 'object') {
          const inputType = currentType.type as DMMF.InputType
          if (!inputType.fields) {
            continue
          }

          if (inputType.meta?.source) {
            // if source is defined, we know model for sure and do not need generic argument
            this._cache.set(key, false)
            continue
          }

          for (const field of inputType.fields) {
            toVisit.push(...field.inputTypes.map((type) => ({ key: getTypeKey(type), type, parent: item })))
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

  private _cacheResultsForTree(item: ToVisitItem): void {
    let currentItem: ToVisitItem | undefined = item
    while (currentItem) {
      this._cache.set(currentItem.key, true)
      currentItem = currentItem.parent
    }
  }

  inputTypeNeedsGenericModelArg(inputType: DMMF.InputType) {
    return this.needsGenericModelArg({ type: inputType, location: 'inputObjectTypes', isList: false })
  }
}

function getTypeKey(type: DMMF.SchemaArgInputType) {
  const parts: string[] = []
  if (type.namespace) {
    parts.push(type.namespace)
  }
  if (typeof type.type === 'string') {
    parts.push(type.type)
  } else {
    parts.push(type.type.name)
  }
  return parts.join('.')
}
