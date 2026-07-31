import type {
  AuthoringArgumentDescriptor,
  AuthoringFieldPresetDescriptor,
} from '@internal/framework-components/authoring';
import type { ColumnTypeDescriptor } from '@internal/framework-components/codec';
import type { ScalarFieldBuilder, ScalarFieldState } from './contract-dsl';

export type UnionToIntersection<U> = (U extends unknown ? (value: U) => void : never) extends (
  value: infer I,
) => void
  ? I
  : never;

export type NamedConstraintSpec<Name extends string | undefined = string | undefined> = {
  readonly name?: Name;
};

export type NamedConstraintState<
  Enabled extends boolean,
  Name extends string | undefined = undefined,
> = Enabled extends true ? NamedConstraintSpec<Name> : undefined;

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
export type ObjectArgumentType<Properties extends Record<string, AuthoringArgumentDescriptor>> = [
  RequiredObjectArgumentKeys<Properties>,
] extends [never]
  ? {
      readonly [K in OptionalObjectArgumentKeys<Properties>]?: ArgTypeFromDescriptor<Properties[K]>;
    }
  : {
      readonly [K in RequiredObjectArgumentKeys<Properties>]: ArgTypeFromDescriptor<Properties[K]>;
    } & {
      readonly [K in OptionalObjectArgumentKeys<Properties>]?: ArgTypeFromDescriptor<Properties[K]>;
    };

export type ArgTypeFromDescriptor<Arg extends AuthoringArgumentDescriptor> = Arg extends {
  readonly kind: 'string';
}
  ? string
  : Arg extends { readonly kind: 'boolean' }
    ? boolean
    : Arg extends { readonly kind: 'number' }
      ? number
      : Arg extends { readonly kind: 'stringArray' }
        ? readonly string[]
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
            ? ObjectArgumentType<Properties>
            : never;

/**
 * Recursive rewrite (not a mapped tuple type) so a descriptor marked
 * `optional: true` gets an optional tuple slot (`Type?`), letting callers
 * omit it and every optional arg after it. Required args must precede
 * optional args in a descriptor's `args` list — TypeScript rejects an
 * optional tuple element followed by a required one, and the runtime
 * (`validateAuthoringHelperArguments`'s `minimumArgs`) already treats an
 * optional-before-required arg as effectively required.
 */
export type TupleFromArgumentDescriptors<Args extends readonly AuthoringArgumentDescriptor[]> =
  Args extends readonly [
    infer Head extends AuthoringArgumentDescriptor,
    ...infer Tail extends readonly AuthoringArgumentDescriptor[],
  ]
    ? Head extends { readonly optional: true }
      ? readonly [ArgTypeFromDescriptor<Head>?, ...TupleFromArgumentDescriptors<Tail>]
      : readonly [ArgTypeFromDescriptor<Head>, ...TupleFromArgumentDescriptors<Tail>]
    : readonly [];

export type SupportsNamedConstraintOptions<Descriptor extends AuthoringFieldPresetDescriptor> =
  Descriptor['output'] extends { readonly id: true }
    ? true
    : Descriptor['output'] extends { readonly unique: true }
      ? true
      : false;

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

export type FieldBuilderFromPresetDescriptor<
  Descriptor extends AuthoringFieldPresetDescriptor,
  Args extends readonly unknown[] = readonly [],
  ConstraintName extends string | undefined = undefined,
> = ScalarFieldBuilder<
  ScalarFieldState<
    ColumnTypeDescriptor<
      ResolveTemplateValue<Descriptor['output']['codecId'], Args> extends string
        ? ResolveTemplateValue<Descriptor['output']['codecId'], Args>
        : string
    >,
    undefined,
    ResolveTemplateValue<Descriptor['output']['nullable'], Args> extends true ? true : false,
    undefined,
    NamedConstraintState<
      ResolveTemplateValue<Descriptor['output']['id'], Args> extends true ? true : false,
      ConstraintName
    >,
    NamedConstraintState<
      ResolveTemplateValue<Descriptor['output']['unique'], Args> extends true ? true : false,
      ConstraintName
    >
  >
>;

export type FieldHelperFunctionWithoutNamedConstraint<
  Descriptor extends AuthoringFieldPresetDescriptor,
> = Descriptor extends {
  readonly args: infer Args extends readonly AuthoringArgumentDescriptor[];
}
  ? <const Params extends TupleFromArgumentDescriptors<Args>>(
      ...args: Params
    ) => FieldBuilderFromPresetDescriptor<Descriptor, Params>
  : () => FieldBuilderFromPresetDescriptor<Descriptor, readonly []>;

/**
 * An intersection of two call signatures rather than one rest-tuple signature
 * with a trailing `options?`. Once optional descriptors yield optional tuple
 * slots, `Params` can infer as the empty tuple, and a single-argument call
 * such as `field.id.nanoid({ size: 16 })` would bind its preset argument to
 * the trailing optional `options` parameter. Resolving the no-options
 * signature first, and falling through to the options-required signature only
 * when the argument list cannot satisfy it, keeps both spellings working.
 */
export type FieldHelperFunctionWithNamedConstraint<
  Descriptor extends AuthoringFieldPresetDescriptor,
> = Descriptor extends {
  readonly args: infer Args extends readonly AuthoringArgumentDescriptor[];
}
  ? (<const Params extends TupleFromArgumentDescriptors<Args>>(
      ...args: Params
    ) => FieldBuilderFromPresetDescriptor<Descriptor, Params>) &
      (<
        const Params extends TupleFromArgumentDescriptors<Args>,
        const Name extends string | undefined = undefined,
      >(
        ...args: [...params: Params, options: NamedConstraintSpec<Name>]
      ) => FieldBuilderFromPresetDescriptor<Descriptor, Params, Name>)
  : <const Name extends string | undefined = undefined>(
      options?: NamedConstraintSpec<Name>,
    ) => FieldBuilderFromPresetDescriptor<Descriptor, readonly [], Name>;

export type FieldHelperFunction<Descriptor extends AuthoringFieldPresetDescriptor> =
  SupportsNamedConstraintOptions<Descriptor> extends true
    ? FieldHelperFunctionWithNamedConstraint<Descriptor>
    : FieldHelperFunctionWithoutNamedConstraint<Descriptor>;

export type FieldHelpersFromNamespace<Namespace> = {
  readonly [K in keyof Namespace]: Namespace[K] extends AuthoringFieldPresetDescriptor
    ? FieldHelperFunction<Namespace[K]>
    : Namespace[K] extends Record<string, unknown>
      ? FieldHelpersFromNamespace<Namespace[K]>
      : never;
};
