import type { ContractField, ExecutionMutationDefaultPhases } from '@internal/contract/types';
import type {
  AuthoringContributions,
  AuthoringFieldPresetDescriptor,
  DataTypeSupport,
} from '@internal/framework-components/authoring';
import {
  diagnosticSource,
  type FieldSymbol,
  type PslDiagnosticCollector,
  type ResolvedTypeConstructorCall,
} from '@internal/psl-parser';
import { instantiatePslFieldPreset } from '@internal/psl-parser/interpret';
import type { PslSources } from '@internal/psl-parser/syntax';
import { ifDefined } from '@internal/utils/defined';
import { getAttribute } from './psl-helpers';

export interface FieldPresetContext {
  readonly authoringContributions: AuthoringContributions | undefined;
  readonly sources: PslSources;
  readonly diagnostics: PslDiagnosticCollector;
  readonly dataTypes: DataTypeSupport;
}

export type FieldPresetResolution =
  | { readonly kind: 'invalid' }
  | {
      readonly kind: 'preset';
      readonly field: ContractField;
      readonly executionDefaults?: ExecutionMutationDefaultPhases;
      /** The preset's path, as in `temporal.createdAt`. */
      readonly helperPath: string;
    };

const INVALID: FieldPresetResolution = { kind: 'invalid' };

function unsupportedContributions(
  instantiated: NonNullable<ReturnType<typeof instantiatePslFieldPreset>>,
): readonly string[] {
  return [
    ...(instantiated.default !== undefined ? ['a storage default'] : []),
    ...(instantiated.id ? ['id semantics'] : []),
    ...(instantiated.unique ? ['a unique constraint'] : []),
  ];
}

export function resolveFieldPreset(input: {
  readonly field: FieldSymbol;
  readonly call: ResolvedTypeConstructorCall;
  readonly descriptor: AuthoringFieldPresetDescriptor;
  readonly ownerName: string;
  readonly context: FieldPresetContext;
}): FieldPresetResolution {
  const { field, call, descriptor, ownerName, context } = input;
  const { diagnostics } = context;
  const source = diagnosticSource(context.sources, field.node.syntax);
  const entityLabel = `Field "${ownerName}.${field.name}"`;
  const helperPath = call.path.join('.');

  if (field.list) {
    diagnostics.push({
      code: 'PSL_PRESET_NOT_LIST',
      message: `${entityLabel} uses a field-preset call as a list element type. Presets cannot be list elements; remove "[]" or use a scalar type.`,
      ...source.at(field.span),
    });
    return INVALID;
  }

  const instantiated = instantiatePslFieldPreset({
    call,
    descriptor,
    diagnostics,
    source,
    entityLabel,
    dataTypes: context.dataTypes,
  });
  if (!instantiated) {
    return INVALID;
  }

  const idAttribute = getAttribute(field.attributes, 'id');
  if (idAttribute && !instantiated.id) {
    diagnostics.push({
      code: 'PSL_PRESET_AND_ID_CONFLICT',
      message: `${entityLabel} uses a field-preset call and cannot also declare @id. Use a preset that contributes id semantics, or drop @id.`,
      ...source.at(idAttribute.span),
    });
    return INVALID;
  }

  const unsupported = unsupportedContributions(instantiated);
  if (unsupported.length > 0) {
    diagnostics.push({
      code: 'PSL_UNSUPPORTED_FIELD_TYPE',
      message: `${entityLabel} uses field preset "${helperPath}", which contributes ${unsupported.join(' and ')}. Mongo supports presets that set a codec and execution defaults only.`,
      ...source.at(call.span),
    });
    return INVALID;
  }

  return {
    kind: 'preset',
    field: {
      type: {
        kind: 'scalar',
        codecId: instantiated.descriptor.codecId,
        ...ifDefined('typeParams', instantiated.descriptor.typeParams),
      },
      nullable: field.optional || instantiated.nullable,
      many: false,
    },
    ...ifDefined('executionDefaults', instantiated.executionDefaults),
    helperPath,
  };
}
