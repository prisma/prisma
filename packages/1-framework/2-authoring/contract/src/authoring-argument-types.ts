import type { AuthoringArgumentDescriptor } from '@internal/framework-components/authoring';

/**
 * For each data type id, the TypeScript value a `value` argument of that data type takes (`argument`) and the type parameter it gives the constructor (`parameter`). A pack declares an entry for each data type it registers that arguments take, as `__dataTypeArguments` in its type.
 */
export type DataTypeArgumentTypes = {
  readonly [dataType: string]: { readonly argument: unknown; readonly parameter: unknown };
};

type NoDataTypeArgumentTypes = Record<never, never>;

export type OptionalObjectArgumentKeys<
  Properties extends Record<string, AuthoringArgumentDescriptor>,
> = {
  readonly [K in keyof Properties]: Properties[K] extends { readonly optional: true } ? K : never;
}[keyof Properties];

type RequiredObjectArgumentKeys<Properties extends Record<string, AuthoringArgumentDescriptor>> =
  Exclude<keyof Properties, OptionalObjectArgumentKeys<Properties>>;

/**
 * When every property is optional the result must be a plain weak type rather
 * than `{} & { … }`: TypeScript's weak-type check rejects an object sharing
 * none of the target's properties, but only when the target is weak — and an
 * intersection with `{}` is not. The TS authoring surface runs no runtime
 * argument validation, so this check is the only thing rejecting a foreign key
 * such as `field.nanoid({ bogus: 1 })`.
 */
export type ObjectArgumentType<
  Properties extends Record<string, AuthoringArgumentDescriptor>,
  ValueTypes extends DataTypeArgumentTypes = NoDataTypeArgumentTypes,
> = [RequiredObjectArgumentKeys<Properties>] extends [never]
  ? {
      readonly [K in OptionalObjectArgumentKeys<Properties>]?: ArgTypeFromDescriptor<
        Properties[K],
        ValueTypes
      >;
    }
  : {
      readonly [K in RequiredObjectArgumentKeys<Properties>]: ArgTypeFromDescriptor<
        Properties[K],
        ValueTypes
      >;
    } & {
      readonly [K in OptionalObjectArgumentKeys<Properties>]?: ArgTypeFromDescriptor<
        Properties[K],
        ValueTypes
      >;
    };

/** The TypeScript type of one argument. A `value` argument takes what `ValueTypes` declares for its data type, and nothing when no pack declares it. */
export type ArgTypeFromDescriptor<
  Arg extends AuthoringArgumentDescriptor,
  ValueTypes extends DataTypeArgumentTypes = NoDataTypeArgumentTypes,
> = Arg extends { readonly kind: 'value'; readonly dataType: infer DataType extends string }
  ? DataType extends keyof ValueTypes
    ? ValueTypes[DataType]['argument']
    : never
  : Arg extends { readonly kind: 'number' }
    ? number
    : Arg extends {
          readonly kind: 'option';
          readonly values: infer Values extends readonly string[];
        }
      ? Values[number]
      : Arg extends {
            readonly kind: 'object';
            readonly properties: infer Properties extends Record<
              string,
              AuthoringArgumentDescriptor
            >;
          }
        ? ObjectArgumentType<Properties, ValueTypes>
        : never;

/**
 * Recursive rewrite (not a mapped tuple type) so a descriptor marked
 * `optional: true` gets an optional tuple slot (`(Type | undefined)?`), letting callers
 * omit it and every optional arg after it, or pass `undefined` to skip it and still give a later one. Required args must precede
 * optional args in a descriptor's `args` list — TypeScript rejects an
 * optional tuple element followed by a required one, and the runtime
 * (`validateAuthoringHelperArguments`'s `minimumArgs`) already treats an
 * optional-before-required arg as effectively required.
 */
export type TupleFromArgumentDescriptors<
  Args extends readonly AuthoringArgumentDescriptor[],
  ValueTypes extends DataTypeArgumentTypes = NoDataTypeArgumentTypes,
> = Args extends readonly [
  infer Head extends AuthoringArgumentDescriptor,
  ...infer Tail extends readonly AuthoringArgumentDescriptor[],
]
  ? Head extends { readonly optional: true }
    ? readonly [
        (ArgTypeFromDescriptor<Head, ValueTypes> | undefined)?,
        ...TupleFromArgumentDescriptors<Tail, ValueTypes>,
      ]
    : readonly [
        ArgTypeFromDescriptor<Head, ValueTypes>,
        ...TupleFromArgumentDescriptors<Tail, ValueTypes>,
      ]
  : readonly [];

type CanonicalArgument<
  Arg extends AuthoringArgumentDescriptor,
  Param,
  ValueTypes extends DataTypeArgumentTypes,
> = Arg extends { readonly kind: 'value'; readonly dataType: infer DataType extends string }
  ? DataType extends keyof ValueTypes
    ? Param extends ValueTypes[DataType]['parameter'] | undefined
      ? Param
      : ValueTypes[DataType]['parameter'] | Extract<Param, undefined>
    : Param
  : Param;

/**
 * The arguments of a call as the constructor receives them: each `value` argument as the canonical value of its data type, kept literal when the written value already is one, so `VarChar(255)` still gives `255` and `` Raw(sql`circle`) `` gives a `string`.
 */
export type CanonicalArguments<
  Args extends readonly AuthoringArgumentDescriptor[],
  Params extends readonly unknown[],
  ValueTypes extends DataTypeArgumentTypes = NoDataTypeArgumentTypes,
> = {
  readonly [Index in keyof Params]: Index extends `${infer Position extends number}`
    ? Args[Position] extends infer Arg extends AuthoringArgumentDescriptor
      ? CanonicalArgument<Arg, Params[Index], ValueTypes>
      : Params[Index]
    : Params[Index];
};

export type ResolveTemplateValue<Template, Args extends readonly unknown[]> = Template extends {
  readonly kind: 'arg';
  readonly index: infer Index extends number;
  readonly path?: infer Path extends readonly string[] | undefined;
  readonly default?: infer Default;
}
  ? ResolveTemplateArgValue<Args[Index], Path, Default, Args>
  : Template extends readonly unknown[]
    ? { readonly [K in keyof Template]: ResolveTemplateValue<Template[K], Args> }
    : Template extends Record<string, unknown>
      ? { readonly [K in keyof Template]: ResolveTemplateValue<Template[K], Args> }
      : Template;

type ResolveTemplatePathValue<
  Value,
  Path extends readonly string[] | undefined,
> = Path extends readonly [infer Segment extends string, ...infer Rest extends readonly string[]]
  ? Segment extends keyof NonNullable<Value>
    ? ResolveTemplatePathValue<NonNullable<Value>[Segment], Rest>
    : never
  : Value;

type ResolveTemplateDefaultValue<
  Value,
  Default,
  Args extends readonly unknown[],
> = Default extends undefined
  ? Value
  : [Value] extends [never]
    ? ResolveTemplateValue<Default, Args>
    : undefined extends Value
      ? Exclude<Value, undefined> | ResolveTemplateValue<Default, Args>
      : Value;

type ResolveTemplateArgValue<
  Value,
  Path extends readonly string[] | undefined,
  Default,
  Args extends readonly unknown[],
> = ResolveTemplateDefaultValue<ResolveTemplatePathValue<Value, Path>, Default, Args>;
