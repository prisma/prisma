/**
 * **Last-resort escape hatch for unsafe type assertions. Not a sanctioned tool to reach for.**
 *
 * Before reaching for `blindCast`, **rewrite the surrounding code so the cast becomes
 * unnecessary**: tighten an input type, add a runtime check that narrows via a type
 * predicate, restructure a generic so the compiler can see the relationship you're
 * asserting, or use {@link castAs} when the value already satisfies the target type.
 * Only when no rewrite is feasible does `blindCast` become the right answer — and at
 * that point, the `Reason` literal you supply must articulate the compromise in
 * language a reviewer can evaluate.
 *
 * The reviewer **will** validate the `Reason`. If it doesn't hold up under scrutiny,
 * that is not a signal to soften the reason; it is a signal to go back and solve the
 * underlying type-system problem properly. An unconvincing justification is rework,
 * not a free pass.
 *
 * `blindCast` is the auditable form of `as Foo` / `as unknown as Foo`: it bypasses
 * the compiler's checks (the input type is `unknown`, the output type is whatever the
 * caller asks for), but it forces the unsafety to be named at the call site instead of
 * smuggled in via a bare `as`. The `Reason` type parameter exists only at compile
 * time — it is not present in the emitted JavaScript — but it is grep-able and
 * visible to future readers.
 *
 * @example
 * ```typescript
 * const stringValue = blindCast<
 *   string,
 *   "JSON.parse returns `unknown`; this field is documented to be a string in the API contract"
 * >(parsed[key]);
 * ```
 *
 * @typeParam TargetType - The type the caller is asserting the input has.
 * @typeParam _Reason - A string literal describing why bypassing the type system is necessary here.
 *                     Only meaningful at compile time. The reviewer evaluates whether it justifies the unsafety.
 */
export function blindCast<TargetType, _Reason extends string>(input: unknown): TargetType {
  // biome-ignore lint/suspicious/noExplicitAny: this helper is the single canonical escape hatch for type-unsafe casts in the codebase; the `any` is hyper-local, the unsafety is made explicit at every call site via the call's own `Reason` literal, and the reviewer evaluates whether that justification holds
  const x: any = input;
  return x;
}

/**
 * Type-checked, runtime pass-through alternative to a bare `as Type` cast.
 *
 * Use `castAs` when the value already satisfies the target type but you want to make
 * the type assertion explicit at the call site — for example, when an inferred type is
 * wider than the type you want to publish, or when a literal object should be tagged
 * with its nominal interface. Unlike {@link blindCast}, the compiler still checks that
 * the value is assignable to the target type, so this helper cannot smuggle in an
 * unsafe assertion.
 *
 * `castAs` exists alongside `blindCast` so authors pick the right name at the call
 * site: a `castAs` is type-checked and benign; a `blindCast` is the unsafe escape
 * hatch. The split makes review faster — readers know which casts to scrutinize and
 * which are pure annotations.
 *
 * @example
 * ```typescript
 * interface FancyObject {
 *   key: string;
 *   keyTwo: {
 *     subKey: string;
 *     subKeyTwo: number;
 *   };
 * }
 *
 * const typedObject = castAs<FancyObject>({
 *   key: 'Chookede',
 *   keyTwo: {
 *     subKey: 'Choookeeeee',
 *     subKeyTwo: 2,
 *   },
 * });
 * ```
 *
 * @typeParam Type - The type to constrain and tag the value with. The value must be assignable to `Type`.
 */
export function castAs<Type>(value: Type): Type {
  return value;
}
