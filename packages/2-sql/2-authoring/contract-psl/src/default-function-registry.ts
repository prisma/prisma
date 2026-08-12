import type {
  ControlMutationDefaultRegistry,
  DefaultFunctionLoweringContext,
  LoweredDefaultResult,
  TypedDefaultFunctionCall,
} from '@internal/framework-components/control';

function formatSupportedFunctionList(registry: ControlMutationDefaultRegistry): string {
  const signatures = Array.from(registry.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([functionName, entry]) => {
      const usageSignatures = entry.usageSignatures?.filter((signature) => signature.length > 0);
      return usageSignatures && usageSignatures.length > 0
        ? usageSignatures
        : [`${functionName}()`];
    });
  return signatures.length > 0 ? signatures.join(', ') : 'none';
}

export function lowerDefaultFunctionWithRegistry(input: {
  readonly call: TypedDefaultFunctionCall;
  readonly registry: ControlMutationDefaultRegistry;
  readonly context: DefaultFunctionLoweringContext;
}): LoweredDefaultResult {
  const entry = input.registry.get(input.call.fn);
  if (entry) {
    return entry.lower({ call: input.call, context: input.context });
  }
  const supportedFunctionList = formatSupportedFunctionList(input.registry);

  return {
    ok: false,
    diagnostic: {
      code: 'PSL_UNKNOWN_DEFAULT_FUNCTION',
      message: `Default function "${input.call.fn}" is not supported in SQL PSL provider v1. Supported functions: ${supportedFunctionList}.`,
      sourceId: input.context.sourceId,
      span: input.call.span,
    },
  };
}
