export type Deferred<T> = {
    resolve(value: T | PromiseLike<T>): void;
    reject(reason: unknown): void;
}


export function createDeferred<T>(): [Deferred<T>, Promise<T>] {
    const deferred = {} as Deferred<T>
    return [deferred, new Promise((resolve, reject) => {
        deferred.resolve = resolve
        deferred.reject = reject
    })]
}