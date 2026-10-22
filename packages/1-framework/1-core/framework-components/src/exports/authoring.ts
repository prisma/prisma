export type {
  AuthoringTypeConstructorCall,
  AuthoringTypeConstructorOutput,
} from '../shared/authoring-type-constructor-call';
export {
  authoringTypeConstructorArguments,
  authoringTypeConstructors,
  findAuthoringTypeConstructorCall,
} from '../shared/authoring-type-constructor-call';
export type {
  AssembledDataTypeSupport,
  DataTypeComponent,
} from '../shared/data-type-support';
export {
  assembleAuthoringDataTypes,
  assembleDataTypeSupport,
} from '../shared/data-type-support';
export type { DiscriminatorField, DiscriminatorRefusal } from '../shared/discriminator-rule';
export { discriminatorRefusals } from '../shared/discriminator-rule';
export {
  type EnumBlockDiagnostic,
  type EnumBlockMember,
  type EnumBlockSite,
  enumMemberProblemDiagnostic,
  readEnumBlockMembers,
} from '../shared/enum-block-members';
export {
  type DecodedEnum,
  type EncodedEnumMember,
  type EnumMemberProblem,
  encodeEnumMembers,
} from '../shared/enum-members';
export {
  type DuplicateStoredValue,
  duplicateStoredMembers,
  type StoredEnumMember,
} from '../shared/enum-stored-members';
export {
  fieldPresetSpellings,
  getAuthoringFieldPreset,
} from '../shared/field-preset-resolution';
export type {
  AuthoringArgRef,
  AuthoringArgumentDescriptor,
  AuthoringAttributeSpecContributions,
  AuthoringColumnDefaultTemplate,
  AuthoringContributions,
  AuthoringDescriptorKinds,
  AuthoringDiagnosticSink,
  AuthoringEntityContext,
  AuthoringEntityTypeDescriptor,
  AuthoringEntityTypeFactoryOutput,
  AuthoringEntityTypeNamespace,
  AuthoringEntityTypeTemplateOutput,
  AuthoringFieldNamespace,
  AuthoringFieldPresetDescriptor,
  AuthoringFieldPresetOutput,
  AuthoringModelAttributeContext,
  AuthoringModelAttributeDescriptor,
  AuthoringModelAttributeDescriptorNamespace,
  AuthoringModelAttributeEntityOutput,
  AuthoringModelAttributeIndexOutput,
  AuthoringModelAttributeLoweringOutput,
  AuthoringPslBlockDescriptor,
  AuthoringPslBlockDescriptorNamespace,
  AuthoringSelectRef,
  AuthoringStorageTypeTemplate,
  AuthoringTemplateValue,
  AuthoringTypeAliasDescriptor,
  AuthoringTypeAliasOutput,
  AuthoringTypeConstructorDescriptor,
  AuthoringTypeConstructorEntityRef,
  AuthoringTypeNamespace,
  AuthoringTypeParamsIssue,
  AuthoringValueArgument,
  AuthoringWarning,
  AuthoringWarningSink,
  DataTypeAuthoringEntry,
  DataTypeWrittenForm,
  ScalarTypeConstructorOutput,
} from '../shared/framework-authoring';
export {
  AUTHORING_TYPE_DESCRIPTOR_KINDS,
  assertNoCrossRegistryCollisions,
  assertResolvableTypeConstructorTemplates,
  assertTypeAliasesValid,
  classifyEnumMemberType,
  collectScalarTypeConstructors,
  flushAuthoringWarnings,
  getAuthoringTypeConstructor,
  instantiateAuthoringEntityType,
  instantiateAuthoringFieldPreset,
  instantiateAuthoringTypeAlias,
  instantiateAuthoringTypeConstructor,
  instantiateAuthoringTypeConstructorFromValues,
  isAuthoringArgRef,
  isAuthoringEntityTypeDescriptor,
  isAuthoringFieldPresetDescriptor,
  isAuthoringModelAttributeDescriptor,
  isAuthoringPslBlockDescriptor,
  isAuthoringSelectRef,
  isAuthoringTypeAliasDescriptor,
  isAuthoringTypeConstructorDescriptor,
  isAuthoringTypeDescriptor,
  mergeAuthoringNamespaces,
  resolveAuthoringTemplateValue,
  resolveEnumCodecId,
  resolveTypeAliasGenerators,
  validateAuthoringHelperArguments,
  validateAuthoringTypeParams,
} from '../shared/framework-authoring';
export type { AuthoringOption } from '../shared/option-descriptor';
export type {
  ParsedPslExtensionBlock,
  PslExtensionBlock,
  PslExtensionBlockParsedAttribute,
  PslExtensionBlockPrintEntry,
} from '../shared/psl-extension-block';
export type { TaggedLiteralCanonicalization } from '../shared/tagged-literal';
export {
  canonicalizeTaggedLiteralBody,
  describeTaggedLiteralFailure,
  printedTaggedLiteralReadsBack,
  printTaggedLiteral,
  resolveTemplateTagEscapes,
  tsTaggedTemplateSource,
} from '../shared/tagged-literal';
export type { PresetStorageTemplate } from '../shared/temporal-presets';
export {
  TEMPORAL_ON_CREATE_ARG,
  TEMPORAL_ON_UPDATE_ARG,
  TIMESTAMP_NOW_GENERATOR_ID,
  temporalAuthoringPresets,
  temporalCodecPreset,
  temporalPhaseTemplate,
  temporalPhaseTemplateWithParams,
  temporalTypeAliases,
} from '../shared/temporal-presets';
export type {
  CastRefusal,
  DataTypeSupport,
  ReadRefusal,
  RefusalDescription,
  RefusalGuidance,
  WrittenForm,
  WrittenScalar,
  WrittenValue,
} from '../shared/written-value';
export {
  admittedForms,
  admittedTags,
  castTypedValue,
  describeAdmittedForms,
  describeExpected,
  describeRefusal,
  describeRefusedValueType,
  entryForPlain,
  entryForTag,
  exactRewrite,
  knownTags,
  readWrittenValue,
  readWrittenValueAs,
  readWrittenValueInto,
  tagForm,
} from '../shared/written-value';
