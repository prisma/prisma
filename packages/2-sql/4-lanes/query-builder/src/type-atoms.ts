/**
 * A utility type to drain outer generics from a type. A compiler micro-optimization.
 *
 * @template TThing The type to drain.
 */
export type DrainOuterGeneric<TThing> = [TThing] extends [unknown] ? TThing : never;

/**
 * A utility type to ensure that exactly one property of an object type is present.
 *
 * @template TObject The object type to check.
 */
export type ExactlyOneProperty<TObject extends object> = {
  [K in keyof TObject]-?: IsNever<Exclude<keyof TObject, K>>;
}[keyof TObject];

/**
 * A utility type to merge two objects.
 *
 * @template TObject0 The first object.
 * @template TObject1 The second object.
 */
export type MergeObjects<TObject0 extends object, TObject1 extends object> = DrainOuterGeneric<
  IsNever<TObject0> extends true
    ? TObject1
    : {
        readonly [K in keyof TObject0 | keyof TObject1]: K extends keyof TObject1
          ? TObject1[K]
          : K extends keyof TObject0
            ? TObject0[K]
            : never;
      }
>;

/**
 * A utility type to determine if a type is `never`.
 *
 * @template TThing The type to check.
 */
export type IsNever<TThing> = [TThing] extends [never] ? true : false;

/**
 * A utility type to simplify an object type for better readability.
 *
 * @template TObject The object type to simplify.
 */
export type Simplify<TObject extends object> = DrainOuterGeneric<
  { [K in keyof TObject]: TObject[K] } & {}
>;
