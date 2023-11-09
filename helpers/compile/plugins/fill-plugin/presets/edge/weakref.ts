export class WeakRef<T> {
  value: T

  constructor(value: T) {
    this.value = value
  }

  deref() {
    return this.value
  }
}
