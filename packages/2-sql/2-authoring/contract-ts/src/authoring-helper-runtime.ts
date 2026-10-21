import { assertSafeAuthoringHelperKey } from '@internal/contract-authoring';
import type {
  AuthoringFieldPresetDescriptor,
  AuthoringTypeNamespace,
} from '@internal/framework-components/authoring';
import {
  instantiateAuthoringFieldPreset,
  instantiateAuthoringTypeAlias,
  instantiateAuthoringTypeConstructor,
  isAuthoringTypeAliasDescriptor,
  isAuthoringTypeConstructorDescriptor,
  validateAuthoringHelperArguments,
  validateAuthoringTypeParams,
} from '@internal/framework-components/authoring';
import type {
  CodecLookupWithDescriptors,
  DataTypeLookup,
  TypeLookups,
} from '@internal/framework-components/codec';
import {
  type AuthoredStorageTypeInstance,
  CODEC_INSTANCE_KIND,
} from '@internal/sql-contract/types';
import { ifDefined } from '@internal/utils/defined';
import type { TypeAliasColumnType } from './contract-dsl';
import { contractError } from './contract-errors';

export type RuntimeNamedConstraintSpec = {
  readonly name?: string;
};

export function isNamedConstraintOptionsLike(value: unknown): value is RuntimeNamedConstraintSpec {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const keys = Object.keys(value as Record<string, unknown>);
  if (keys.some((key) => key !== 'name')) {
    return false;
  }

  const name = (value as { readonly name?: unknown }).name;
  return name === undefined || typeof name === 'string';
}

export function createTypeHelpersFromNamespace(
  namespace: AuthoringTypeNamespace,
  lookups: TypeLookups<CodecLookupWithDescriptors, DataTypeLookup>,
  path: readonly string[] = [],
): Record<string, unknown> {
  const helpers: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(namespace)) {
    assertSafeAuthoringHelperKey(key, path);
    const currentPath = [...path, key];

    if (isAuthoringTypeConstructorDescriptor(value)) {
      const helperPath = currentPath.join('.');
      helpers[key] = (...args: readonly unknown[]): AuthoredStorageTypeInstance => {
        validateAuthoringHelperArguments(helperPath, value.args, args);
        const output = instantiateAuthoringTypeConstructor(value, args);
        validateAuthoringTypeParams(
          helperPath,
          value.output,
          output.typeParams,
          lookups.codecLookup.descriptorFor(output.codecId)?.paramsSchema,
        );
        return {
          kind: CODEC_INSTANCE_KIND,
          codecId: output.codecId,
          typeParams: output.typeParams ?? {},
        };
      };
      continue;
    }

    if (isAuthoringTypeAliasDescriptor(value)) {
      const helperPath = currentPath.join('.');
      helpers[key] = (...args: readonly unknown[]): TypeAliasColumnType => {
        validateAuthoringHelperArguments(helperPath, [], args);
        const {
          type,
          default: columnDefault,
          onCreate,
          onUpdate,
        } = instantiateAuthoringTypeAlias(value);
        const generatorCalls = {
          ...ifDefined('onCreate', onCreate),
          ...ifDefined('onUpdate', onUpdate),
        };
        return {
          kind: CODEC_INSTANCE_KIND,
          codecId: type.codecId,
          typeParams: type.typeParams ?? {},
          ...ifDefined('default', columnDefault),
          ...(Object.keys(generatorCalls).length === 0 ? {} : { generatorCalls }),
        };
      };
      continue;
    }

    helpers[key] = createTypeHelpersFromNamespace(value, lookups, currentPath);
  }

  return helpers;
}

export function createFieldPresetHelper<Result>(options: {
  readonly helperPath: string;
  readonly descriptor: AuthoringFieldPresetDescriptor;
  readonly codecLookup: CodecLookupWithDescriptors;
  readonly build: (options: {
    readonly args: readonly unknown[];
    readonly namedConstraintOptions?: RuntimeNamedConstraintSpec;
  }) => Result;
}): (...rawArgs: readonly unknown[]) => Result {
  return (...rawArgs: readonly unknown[]) => {
    const acceptsNamedConstraintOptions =
      options.descriptor.output.id === true || options.descriptor.output.unique === true;
    const declaredArguments = options.descriptor.args ?? [];

    if (acceptsNamedConstraintOptions && rawArgs.length > declaredArguments.length + 1) {
      throw contractError(
        'CONTRACT.ARGUMENT_INVALID',
        `${options.helperPath} expects at most ${declaredArguments.length + 1} argument(s), received ${rawArgs.length}`,
        {
          meta: {
            helperPath: options.helperPath,
            expected: declaredArguments.length + 1,
            received: rawArgs.length,
          },
        },
      );
    }

    let args = rawArgs;
    let namedConstraintOptions: RuntimeNamedConstraintSpec | undefined;

    if (acceptsNamedConstraintOptions && rawArgs.length === declaredArguments.length + 1) {
      const maybeNamedConstraintOptions = rawArgs.at(-1);
      if (!isNamedConstraintOptionsLike(maybeNamedConstraintOptions)) {
        throw contractError(
          'CONTRACT.ARGUMENT_INVALID',
          `${options.helperPath} accepts an optional trailing { name?: string } constraint options object`,
          { meta: { helperPath: options.helperPath } },
        );
      }
      namedConstraintOptions = maybeNamedConstraintOptions;
      args = rawArgs.slice(0, -1);
    }

    validateAuthoringHelperArguments(options.helperPath, options.descriptor.args, args);
    const output = options.descriptor.output;
    validateAuthoringTypeParams(
      options.helperPath,
      output,
      instantiateAuthoringFieldPreset(options.descriptor, args).descriptor.typeParams,
      options.codecLookup.descriptorFor(output.codecId)?.paramsSchema,
    );

    return options.build({
      args,
      ...(namedConstraintOptions ? { namedConstraintOptions } : {}),
    });
  };
}
