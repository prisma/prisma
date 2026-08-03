import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { classifyPublishResult } from './publish-packages-utils.mjs';

describe('classifyPublishResult', () => {
  it('treats exit 0 as ok and not already-published', () => {
    const result = classifyPublishResult({
      code: 0,
      output: '+ @internal/contract@0.9.0',
    });
    assert.deepEqual(result, { ok: true, alreadyPublished: false });
  });

  it('treats npm "cannot publish over previously published" as ok with alreadyPublished', () => {
    const result = classifyPublishResult({
      code: 1,
      output: [
        'npm notice 📦  @internal/middleware-cache@0.9.0',
        'npm error You cannot publish over the previously published versions: 0.9.0.',
        'npm error A complete log of this run can be found in: ...',
      ].join('\n'),
    });
    assert.deepEqual(result, { ok: true, alreadyPublished: true });
  });

  it('treats other non-zero exits as failures', () => {
    const result = classifyPublishResult({
      code: 1,
      output: [
        'npm error code ENEEDAUTH',
        'npm error need auth This command requires you to be logged in to https://registry.npmjs.org',
      ].join('\n'),
    });
    assert.deepEqual(result, { ok: false, alreadyPublished: false });
  });

  it('treats spawn errors (no captured npm output) as failures', () => {
    const result = classifyPublishResult({
      code: 1,
      output: 'spawn error: ENOENT',
    });
    assert.deepEqual(result, { ok: false, alreadyPublished: false });
  });
});
