import type { ContractSourceContext } from '@internal/config/config-types';
import { loadConfigForSections, type PrismaNextConfig } from '@internal/config-loader';
import type { ControlStack } from '@internal/framework-components/control';
import { createControlStack } from '@internal/framework-components/control';
import type { FormatOptions } from '@internal/psl-parser/format';
import { hasPslInterpreter, type PslInterpretCapable } from '@internal/psl-parser/interpret';
import type { PipelineInputs } from './pipeline';
import { hasPslInputs, resolveSchemaInputs, type SchemaInputSet } from './schema-inputs';

export const CONFIG_FILENAME = 'prisma-next.config.ts';

export interface ProjectInterpretation {
  readonly source: PslInterpretCapable;
  readonly context: ContractSourceContext;
}

export interface ConfigResolution {
  readonly inputs: SchemaInputSet;
  readonly formatter?: FormatOptions;
  readonly controlStack: PipelineInputs;
  readonly interpretation?: ProjectInterpretation;
}

const emptyPipelineInputs: PipelineInputs = {
  scalarTypes: [],
  pslBlockDescriptors: {},
};

export async function resolveConfigInputs(configPath: string): Promise<ConfigResolution> {
  // The language server keeps its established failure channel: a config that
  // cannot serve the project is thrown and published as a document diagnostic.
  const configResult = await loadConfigForSections(configPath, [
    'family',
    'target',
    'adapter',
    'driver',
    'extensions',
    'contract',
    'formatter',
  ]);
  if (!configResult.ok) {
    throw configResult.failure;
  }
  const config = configResult.value;
  const inputs = resolveSchemaInputs(config);
  if (!hasPslInputs(config)) {
    return {
      inputs,
      controlStack: emptyPipelineInputs,
      ...(config.formatter === undefined ? {} : { formatter: config.formatter }),
    };
  }
  const stack = createControlStack(config);
  const interpretation = resolveInterpretation(config, stack, inputs);
  return {
    inputs,
    controlStack: pipelineInputsFromStack(stack),
    ...(config.formatter === undefined ? {} : { formatter: config.formatter }),
    ...(interpretation === undefined ? {} : { interpretation }),
  };
}

function pipelineInputsFromStack(stack: ControlStack): PipelineInputs {
  return {
    scalarTypes: [...stack.scalarTypes],
    pslBlockDescriptors: stack.authoringContributions.pslBlockDescriptors,
  };
}

function resolveInterpretation(
  config: PrismaNextConfig,
  stack: ControlStack,
  inputs: SchemaInputSet,
): ProjectInterpretation | undefined {
  const source = config.contract?.source;
  if (source === undefined || !hasPslInterpreter(source)) {
    return undefined;
  }
  return {
    source,
    context: {
      composedExtensions: stack.extensions.map((p) => p.id),
      composedExtensionContracts: stack.extensionContracts,
      authoringContributions: stack.authoringContributions,
      codecLookup: stack.codecLookup,
      controlMutationDefaults: stack.controlMutationDefaults,
      resolvedInputs: [...inputs.uris()],
      capabilities: stack.capabilities,
    },
  };
}
