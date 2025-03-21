type CacheEntry<V> = {
  value: V
}
export class Cache<K, V> {
  private _map = new Map<K, CacheEntry<V>>()

  get(key: K): V | undefined {
    return this._map.get(key)?.value
  }

  set(key: K, value: V): void {
    this._map.set(key, { value })
  }

  getOrCreate(key: K, create: () => V): V {
    const cached = this._map.get(key)
    if (cached) {
      return cached.value
    }
    const value = create()
    this.set(key, value)
    return value
  }
}
