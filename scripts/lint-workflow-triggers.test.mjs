import { deepStrictEqual, doesNotMatch, match, strictEqual } from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { findViolations, stripYamlComment } from './lint-workflow-triggers.mjs';

const readWorkflow = (name) =>
  readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), 'utf8');

describe('PR execution credentials', () => {
  for (const name of ['bundle-size', 'pr-code-security', 'preview-publish']) {
    it(`${name} has no write permissions, secret inputs, or persisted checkout credentials`, () => {
      const source = readWorkflow(name);
      doesNotMatch(source, /:\s*write\b|secrets[.:]|pull_request_target|workflow_run/);
      match(source, /permissions:\n {2}contents: read/);
      const checkouts = source.split(/uses: actions\/checkout@/).slice(1);
      strictEqual(checkouts.length > 0, true);
      for (const checkout of checkouts) {
        match(checkout.split(/\n\s*- /)[0], /persist-credentials: false/);
      }
    });
  }

  it('runs Gitleaks directly for forks and retains redacted findings', () => {
    const source = readWorkflow('pr-code-security');
    doesNotMatch(source, /gitleaks-action|head\.repo\.fork|secrets: inherit/);
    match(source, /sha256sum --check/);
    match(source, /gitleaks" git .*--redact=100/);
    match(source, /--log-opts="\$BASE_SHA\.\.\$HEAD_SHA"/);
  });

  it('publishes preview arguments as data, without PR comments', () => {
    const source = readWorkflow('preview-publish');
    const script = source.match(
      /- name: Publish to pkg\.pr\.new[\s\S]*?run: \|\n((?: {10}[^\n]*\n|\n)+)/,
    )?.[1];
    strictEqual(typeof script, 'string');
    doesNotMatch(script, /\$\{\{/);
    const run = (packages) =>
      spawnSync(
        'bash',
        [
          '-euo',
          'pipefail',
          '-c',
          `
      node() { printf '%s\\n' "$TEST_PACKAGES"; }
      pnpm() { printf '%s\\n' "$@"; }
      ${script}
    `,
        ],
        { env: { PATH: process.env.PATH, TEST_PACKAGES: packages }, encoding: 'utf8' },
      );
    const valid = run(
      './packages/9-public/@prisma/orm-sql ./packages/9-public/@prisma/orm-postgres',
    );
    strictEqual(valid.status, 0, valid.stderr);
    match(
      valid.stdout,
      /--comment=off\n--json\npreview-packages.json\n\.\/packages\/9-public\/@prisma\/orm-sql\n\.\/packages\/9-public\/@prisma\/orm-postgres/,
    );
    for (const invalid of [
      '',
      '--comment=update',
      './packages/a;exit 0',
      './packages/$(exit 0)',
      './packages/a\n--comment=update',
      './packages/../outside',
      './packages/*',
    ]) {
      strictEqual(run(invalid).status, 1, invalid);
    }
  });
});

describe('stripYamlComment', () => {
  it('returns the line unchanged when no comment is present', () => {
    strictEqual(stripYamlComment('on: pull_request'), 'on: pull_request');
  });

  it('strips a trailing comment after whitespace', () => {
    strictEqual(stripYamlComment('on: pull_request  # this is fine'), 'on: pull_request  ');
  });

  it('strips a full-line comment', () => {
    strictEqual(stripYamlComment('# pull_request_target is forbidden'), '');
  });

  it('does not strip a # that is part of an unquoted value', () => {
    strictEqual(stripYamlComment('ref: refs/heads/main#fragment'), 'ref: refs/heads/main#fragment');
  });

  it('does not strip a # inside a single-quoted string', () => {
    strictEqual(stripYamlComment("title: 'this # is data'"), "title: 'this # is data'");
  });

  it('does not strip a # inside a double-quoted string', () => {
    strictEqual(stripYamlComment('title: "this # is data"'), 'title: "this # is data"');
  });

  it('treats \\" as an escaped quote (does not close the string)', () => {
    const input = 'title: "value with \\" still inside # not a comment"';
    strictEqual(stripYamlComment(input), input);
  });

  it('treats \\\\" as a closed string preceded by a literal backslash', () => {
    strictEqual(stripYamlComment('title: "value\\\\" # comment'), 'title: "value\\\\" ');
  });

  it('treats \\\\\\" as an escaped quote after a literal backslash', () => {
    const input = 'title: "value\\\\\\" still inside # not a comment"';
    strictEqual(stripYamlComment(input), input);
  });
});

describe('findViolations', () => {
  it('passes a workflow that uses pull_request', () => {
    const source = ['name: CI', 'on:', '  pull_request:', ''].join('\n');
    deepStrictEqual(findViolations(source), []);
  });

  it('passes a workflow that uses push', () => {
    const source = ['name: Publish', 'on:', '  push:', '    branches: [main]'].join('\n');
    deepStrictEqual(findViolations(source), []);
  });

  it('flags pull_request_target declared in block style', () => {
    const source = ['name: Labeler', 'on:', '  pull_request_target:', '    types: [opened]'].join(
      '\n',
    );
    const hits = findViolations(source);
    strictEqual(hits.length, 1);
    strictEqual(hits[0].line, 3);
  });

  it('flags pull_request_target declared in flow style', () => {
    const source = ['name: Labeler', 'on: [pull_request_target]', ''].join('\n');
    const hits = findViolations(source);
    strictEqual(hits.length, 1);
    strictEqual(hits[0].line, 2);
  });

  it('flags pull_request_target as one of several events in flow style', () => {
    const source = ['name: Labeler', 'on: [push, pull_request_target, schedule]', ''].join('\n');
    const hits = findViolations(source);
    strictEqual(hits.length, 1);
    strictEqual(hits[0].line, 2);
  });

  it('flags pull_request_target referenced in an if expression', () => {
    const source = [
      'name: CI',
      'on: pull_request',
      'jobs:',
      '  noop:',
      "    if: github.event_name == 'pull_request_target'",
      '    runs-on: ubuntu-latest',
      '    steps: []',
    ].join('\n');
    const hits = findViolations(source);
    strictEqual(hits.length, 1);
    strictEqual(hits[0].line, 5);
  });

  it('does not flag pull_request_target inside a YAML comment', () => {
    const source = [
      'name: CI',
      '# We deliberately do not use pull_request_target — see supply-chain.md',
      'on: pull_request',
    ].join('\n');
    deepStrictEqual(findViolations(source), []);
  });

  it('does not flag related-but-different events (boundary cases)', () => {
    deepStrictEqual(findViolations('on: pull_request_review'), []);
    deepStrictEqual(findViolations('on: pull_request'), []);
  });
});
