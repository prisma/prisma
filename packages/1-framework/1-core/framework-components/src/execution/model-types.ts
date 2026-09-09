/**
 * Phantom key an emitted model type carries to name its relation properties.
 * Never present at runtime; `Scalars` and `Shape` read it to tell relations from fields.
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
 * An application data structure derived from a model.
 *
 * At every level of `Spec`: `'+'` names the scalars and relations to keep; `'-'` names scalars to drop;
 * any other key is a relation whose value is the spec for the related model (`{}` is all scalars, no
 * relations). Relations are absent unless asked for; cardinality and nullability come from the model.
 * Distributes over a union, so each variant of `Any<Base>` keeps only its own relations.
 */
export type Shape<M, Spec extends ShapeSpec<M, Spec> = Record<never, never>> = ShapeOf<M, Spec>;

/**
 * The constraint a `Shape` spec satisfies. A generic that forwards a spec needs it:
 * `type Response<S extends ShapeSpec<User, S>> = Shape<User, S>`.
 */
export type ShapeSpec<M, Spec> = {
  readonly [K in keyof Spec]: K extends '+'
    ? '-' extends keyof Spec
      ? never
      : Exclude<ScalarNamesOf<M> | RelationNamesOf<M>, keyof Spec>
    : K extends '-'
      ? '+' extends keyof Spec
        ? never
        : ScalarNamesOf<M>
      : K extends RelationNamesOf<M>
        ? ShapeSpec<RelatedModel<M, K>, Spec[K]>
        : UnknownSpecKey<M, K>;
};

type UnknownSpecKey<M, K> = [RelationNamesOf<M>] extends [never]
  ? `'${K & string}' is not a relation of the model, which has none; try '+' or '-'`
  : `'${K & string}' is not a relation of the model; try '+', '-', or '${RelationNamesOf<M>}'`;

type ScalarNamesOf<M> = M extends unknown ? keyof Scalars<M> & string : never;

type RelatedModel<M, K> = M extends unknown
  ? K extends keyof M
    ? UnwrapRelation<M[K]>
    : never
  : never;

type UnwrapRelation<V> = V extends (infer Item)[] ? Item : NonNullable<V>;

type ShapeOf<M, Spec> = M extends unknown
  ? Flatten<
      KeptScalars<M, Spec> & {
        [K in IncludedRelations<M, Spec>]: WrapLike<
          M[K],
          ShapeOf<RelatedModel<M, K>, NestedSpec<Spec, K>>
        >;
      }
    >
  : never;

type KeptScalars<M, Spec> = Spec extends { readonly '+': infer Keep }
  ? Pick<Scalars<M>, Extract<Keep, keyof Scalars<M>>>
  : Spec extends { readonly '-': infer Drop extends PropertyKey }
    ? Omit<Scalars<M>, Drop>
    : Scalars<M>;

type IncludedRelations<M, Spec> = Extract<
  keyof Spec | (Spec extends { readonly '+': infer Keep } ? Keep : never),
  RelationNamesOf<M> & keyof M
>;

type NestedSpec<Spec, K> = K extends keyof Spec ? Spec[K] : Record<never, never>;

type WrapLike<V, R> = V extends unknown[] ? R[] : null extends V ? R | null : R;

type Flatten<T> = { [K in keyof T]: T[K] };
