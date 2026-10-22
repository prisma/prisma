import type { ResolvedAttributeArg, ResolvedTypeConstructorCall } from './resolve';

/** The call as the schema writes it, with its arguments separated by `, `. */
export function printTypeConstructorCall(call: ResolvedTypeConstructorCall): string {
  const args = call.args.map((arg) =>
    arg.kind === 'named' ? `${arg.name}: ${arg.value}` : arg.value,
  );
  return `${call.path.join('.')}(${args.join(', ')})`;
}

/**
 * Each argument's value, keyed by the parameter it fills: a positional argument fills the parameter at its position, a named one the parameter it names. `undefined` when an argument fills no parameter, fills one an earlier argument filled, or is positional after a named one.
 */
export function argumentsByParameter(
  args: readonly ResolvedAttributeArg[],
  parameters: readonly string[],
): ReadonlyMap<string, string> | undefined {
  const filled = new Map<string, string>();
  let named = false;
  for (const [index, arg] of args.entries()) {
    named ||= arg.kind === 'named';
    if (arg.kind === 'positional' && named) return undefined;
    const parameter = arg.kind === 'named' ? arg.name : parameters[index];
    if (parameter === undefined || !parameters.includes(parameter) || filled.has(parameter)) {
      return undefined;
    }
    filled.set(parameter, arg.value);
  }
  return filled;
}
