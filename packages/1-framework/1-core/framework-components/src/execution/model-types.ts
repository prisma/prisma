/**
 * Phantom key an emitted model type carries to name its relation properties.
 * Never present at runtime; `Scalars` and `With` read it to tell relations from fields.
 */
export const RelationKeys: unique symbol = Symbol('RelationKeys');

/**
 * The relation names an emitted model type declares.
 */
export type RelationNamesOf<M> = M extends { readonly [RelationKeys]?: infer R extends string }
  ? R
  : never;

/**
 * The scalar row of a model: every field, no relations, no phantom.
 * Distributes over a union, so the row of a polymorphic `Any<Base>` is the union of its variants' rows.
 */
export type Scalars<M> = M extends { readonly [RelationKeys]?: infer R extends string }
  ? Omit<M, R | typeof RelationKeys>
  : M;

/**
 * The scalar row of a model plus the named relations, each as the related model's scalar row.
 * One level only; the relation names must be relations of `M`.
 */
export type With<M, R extends RelationNamesOf<M>> = Flatten<
  Scalars<M> & {
    [K in R]: M[K & keyof M] extends (infer Item)[]
      ? Scalars<Item>[]
      : null extends M[K & keyof M]
        ? Scalars<NonNullable<M[K & keyof M]>> | null
        : Scalars<M[K & keyof M]>;
  }
>;

type Flatten<T> = { [K in keyof T]: T[K] };
