/**
 * Names that runtimes and inspection tools read on any object to learn what it is: `then` when a promise resolves to it, `toJSON` in `JSON.stringify`, and the keys test matchers and printers probe. A read of one of them is never a call the caller meant.
 */
const PROBED_NAMES: ReadonlySet<string> = new Set([
  'then',
  'toJSON',
  'asymmetricMatch',
  'nodeType',
  'tagName',
  'inspect',
]);

const HELPER_NAME = /^[a-z][A-Za-z0-9]*$/;

/**
 * Makes a read of a property `object` does not have return what `read` returns for its name, or throw what `read` throws. It reads only names shaped like a helper method; a symbol, an `Object.prototype` member, and a name in {@link PROBED_NAMES} read as on a plain object. The object's own properties are found before the answer is asked for, so reading them costs nothing more. Returns `object`, whose prototype now holds the answer.
 */
export function answerMissingPropertyReads<T extends object>(
  object: T,
  read: (name: string) => unknown,
): T {
  const plain = {};
  Object.setPrototypeOf(
    object,
    new Proxy(plain, {
      get(target, key, receiver) {
        if (
          typeof key === 'symbol' ||
          key in target ||
          PROBED_NAMES.has(key) ||
          !HELPER_NAME.test(key)
        ) {
          return Reflect.get(target, key, receiver);
        }
        return read(key);
      },
    }),
  );
  return object;
}
