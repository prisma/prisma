import { describe, expect, it } from 'vitest';
import {
  nanoidIdPresetMirror,
  nanoidOptionsArgumentMirror,
  nanoidPresetMirror,
} from '../../2-authoring/contract-ts/test/nanoid-preset-mirror';
import { sqlFamilyAuthoringFieldPresets } from '../src/core/authoring-field-presets';

/**
 * contract-ts hand-mirrors these two shipping presets because it cannot import
 * family-sql (family-sql depends on contract-ts in production, so the reverse
 * is a cycle). Its authoring type tests, helper-runtime tests, and contract
 * DSL tests all run against those mirrors.
 *
 * These assertions are the only thing that fails if a change here leaves the
 * mirrors stale — the mirrors are otherwise pinned by nothing.
 *
 * The `args[0]` assertions carry the most weight. `nanoidOptionsArgument`
 * declares every property optional, which makes contract-ts's
 * `ObjectArgumentType` emit a plain weak type; weak-type detection is then the
 * only thing rejecting `field.id.nanoid({ bogus: 1 })` and the only thing
 * routing `field.id.nanoid({ name: 'x' })` to the named-constraint overload,
 * because the TS authoring surface performs no runtime argument validation
 * (`buildFieldPreset` calls `instantiateAuthoringFieldPreset` directly).
 * Making `size` required would send `ObjectArgumentType` down its intersection
 * branch and silently remove that protection — producing an unnamed primary
 * key on a length-21 nanoid column with no diagnostic at any layer. These
 * assertions exist so that change lands as a red test instead.
 */
describe('contract-ts mirrors of the nanoid presets', () => {
  it('mirrors the nanoid options argument that keeps the weak-type check alive', () => {
    expect(nanoidOptionsArgumentMirror).toEqual(sqlFamilyAuthoringFieldPresets.nanoid.args[0]);
    expect(nanoidOptionsArgumentMirror).toEqual(sqlFamilyAuthoringFieldPresets.id.nanoid.args[0]);
  });

  it('mirrors the nanoid preset', () => {
    expect(nanoidPresetMirror).toEqual(sqlFamilyAuthoringFieldPresets.nanoid);
  });

  it('mirrors the id.nanoid preset', () => {
    expect(nanoidIdPresetMirror).toEqual(sqlFamilyAuthoringFieldPresets.id.nanoid);
  });
});
