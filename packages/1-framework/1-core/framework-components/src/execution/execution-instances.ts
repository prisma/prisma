import type {
  AdapterInstance,
  DriverInstance,
  ExtensionInstance,
  FamilyInstance,
  TargetInstance,
} from '../shared/framework-components';

export interface RuntimeFamilyInstance<TFamilyId extends string>
  extends FamilyInstance<TFamilyId> {}

export interface RuntimeTargetInstance<TFamilyId extends string, TTargetId extends string>
  extends TargetInstance<TFamilyId, TTargetId> {}

export interface RuntimeAdapterInstance<TFamilyId extends string, TTargetId extends string>
  extends AdapterInstance<TFamilyId, TTargetId> {}

export interface RuntimeDriverInstance<TFamilyId extends string, TTargetId extends string>
  extends DriverInstance<TFamilyId, TTargetId> {}

export interface RuntimeExtensionInstance<TFamilyId extends string, TTargetId extends string>
  extends ExtensionInstance<TFamilyId, TTargetId> {}
