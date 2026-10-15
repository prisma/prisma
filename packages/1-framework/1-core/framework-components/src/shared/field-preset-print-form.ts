import { isExecutionMutationDefaultValue } from '@internal/contract/types';
import { ifDefined } from '@internal/utils/defined';
import {
  type AuthoringArgumentDescriptor,
  type AuthoringFieldNamespace,
  type AuthoringFieldPresetDescriptor,
  type AuthoringTemplateValue,
  isAuthoringArgRef,
  isAuthoringFieldPresetDescriptor,
  isAuthoringSelectRef,
} from './framework-authoring';
import { runtimeError } from './runtime-error';

/** The option argument that switches a preset's phase on, and the value of it that selects each generator. */
export interface FieldPresetPhasePrintForm {
  readonly argument: string;
  readonly valuesByGenerator: ReadonlyMap<string, string>;
}

/**
 * How `contract print` writes a column with a field preset: the codec the preset writes, the column type params its leading positional arguments write, in order, and for each phase the option argument that selects a generator.
 */
export interface FieldPresetPrintForm {
  readonly codecId: string;
  readonly typeParams: readonly string[];
  readonly onCreate?: FieldPresetPhasePrintForm;
  readonly onUpdate?: FieldPresetPhasePrintForm;
}

export interface PrintableFieldPreset {
  readonly path: readonly string[];
  readonly printForm: FieldPresetPrintForm;
}

/** For each codec, the field preset that writes it with each generator. */
export type FieldPresetsByCodecAndGenerator = ReadonlyMap<
  string,
  ReadonlyMap<string, PrintableFieldPreset>
>;

const UNREADABLE = 'unreadable';

function positionalTypeParams(
  typeParams: Readonly<Record<string, AuthoringTemplateValue>> | undefined,
  args: readonly AuthoringArgumentDescriptor[],
): readonly string[] | typeof UNREADABLE {
  const byIndex: string[] = [];
  for (const [name, template] of Object.entries(typeParams ?? {})) {
    if (!isAuthoringArgRef(template) || template.path !== undefined) return UNREADABLE;
    if (template.default !== undefined || byIndex[template.index] !== undefined) return UNREADABLE;
    const argument = args[template.index];
    if (argument === undefined || argument.kind === 'option') return UNREADABLE;
    byIndex[template.index] = name;
  }
  const names = byIndex.filter((name) => name !== undefined);
  return names.length === byIndex.length ? names : UNREADABLE;
}

function phasePrintForm(
  template: AuthoringTemplateValue | undefined,
  args: readonly AuthoringArgumentDescriptor[],
): FieldPresetPhasePrintForm | undefined | typeof UNREADABLE {
  if (template === undefined) return undefined;
  if (!isAuthoringSelectRef(template) || template.path !== undefined) return UNREADABLE;
  const argument = args[template.index];
  if (argument?.kind !== 'option' || argument.name === undefined) return UNREADABLE;
  const valuesByGenerator = new Map<string, string>();
  for (const [value, selected] of Object.entries(template.cases)) {
    if (!isExecutionMutationDefaultValue(selected)) return UNREADABLE;
    if (!valuesByGenerator.has(selected.id)) valuesByGenerator.set(selected.id, value);
  }
  return { argument: argument.name, valuesByGenerator };
}

/**
 * The print form of a preset whose option arguments select its generators, read from its `args` and `output`. A preset of any other shape, such as one with a fixed generator, a database default or an id, has none.
 */
export function fieldPresetPrintForm(
  descriptor: AuthoringFieldPresetDescriptor,
): FieldPresetPrintForm | undefined {
  const { output } = descriptor;
  const args = descriptor.args ?? [];
  if (output.default !== undefined || output.id === true || output.unique === true) {
    return undefined;
  }
  const typeParams = positionalTypeParams(output.typeParams, args);
  const onCreate = phasePrintForm(output.executionDefaults?.onCreate, args);
  const onUpdate = phasePrintForm(output.executionDefaults?.onUpdate, args);
  if (typeParams === UNREADABLE || onCreate === UNREADABLE || onUpdate === UNREADABLE) {
    return undefined;
  }
  if (onCreate === undefined && onUpdate === undefined) return undefined;
  return {
    codecId: output.codecId,
    typeParams,
    ...ifDefined('onCreate', onCreate),
    ...ifDefined('onUpdate', onUpdate),
  };
}

function printableFieldPresets(
  namespace: AuthoringFieldNamespace,
  path: readonly string[] = [],
): PrintableFieldPreset[] {
  return Object.entries(namespace).flatMap(([name, member]) => {
    const memberPath = [...path, name];
    if (!isAuthoringFieldPresetDescriptor(member)) return printableFieldPresets(member, memberPath);
    const printForm = fieldPresetPrintForm(member);
    return printForm === undefined ? [] : [{ path: memberPath, printForm }];
  });
}

/**
 * Indexes the presets in `field` that have a print form by codec and generator. Throws `CONTRACT.PACK_CONTRIBUTION_INVALID` when two presets write one codec with one generator, so `contract print` has one preset to write a column with (ADR 246: one preset per codec).
 */
export function assembleFieldPresetsByCodecAndGenerator(
  field: AuthoringFieldNamespace,
): FieldPresetsByCodecAndGenerator {
  const byCodec = new Map<string, Map<string, PrintableFieldPreset>>();
  for (const preset of printableFieldPresets(field)) {
    const { codecId, onCreate, onUpdate } = preset.printForm;
    const byGenerator = byCodec.get(codecId) ?? new Map<string, PrintableFieldPreset>();
    byCodec.set(codecId, byGenerator);
    const generatorIds = new Set([
      ...(onCreate?.valuesByGenerator.keys() ?? []),
      ...(onUpdate?.valuesByGenerator.keys() ?? []),
    ]);
    for (const generatorId of generatorIds) {
      const existing = byGenerator.get(generatorId);
      if (existing !== undefined) {
        throw runtimeError(
          'CONTRACT.PACK_CONTRIBUTION_INVALID',
          `Field presets "${existing.path.join('.')}" and "${preset.path.join('.')}" both write codec "${codecId}" with generator "${generatorId}", so \`contract print\` cannot choose one. Register one of them only.`,
        );
      }
      byGenerator.set(generatorId, preset);
    }
  }
  return byCodec;
}
