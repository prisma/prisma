import { type StartupParameterRecorder, startStartupParameterRecorder } from '@repo/test-utils';
import pg from 'pg';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import postgresControlDriverDescriptor from '../src/exports/control';
import { createBoundDriverFromBinding } from '../src/postgres-driver';
import { queryRows } from './sql-queryable-test-utils';

const URL_OPTIONS = 'options=-c%20search_path%3Dreports%20-c%20DateStyle%3DGerman';

describe('the startup options of a connection', () => {
  let recorder: StartupParameterRecorder;

  beforeEach(async () => {
    recorder = await startStartupParameterRecorder();
  });

  afterEach(async () => {
    await recorder.close();
  });

  it('set DateStyle=ISO, after the options the URL gives, on a runtime connection Prisma opens', async () => {
    const driver = createBoundDriverFromBinding(
      { kind: 'url', url: `${recorder.url}?${URL_OPTIONS}` },
      undefined,
    );
    await queryRows(driver, 'select 1').catch(() => undefined);
    await driver.close().catch(() => undefined);

    expect((await recorder.next())['options']).toBe(
      '-c search_path=reports -c DateStyle=German -c DateStyle=ISO',
    );
  });

  it('set DateStyle=ISO on a control connection Prisma opens', async () => {
    await postgresControlDriverDescriptor.create(recorder.url).catch(() => undefined);

    expect((await recorder.next())['options']).toBe('-c DateStyle=ISO');
  });

  it('are left as they are on a client the application supplies', async () => {
    const driver = createBoundDriverFromBinding(
      {
        kind: 'pgClient',
        client: new pg.Client({ connectionString: `${recorder.url}?${URL_OPTIONS}` }),
      },
      undefined,
    );
    await queryRows(driver, 'select 1').catch(() => undefined);
    await driver.close().catch(() => undefined);

    expect((await recorder.next())['options']).toBe('-c search_path=reports -c DateStyle=German');
  });
});
