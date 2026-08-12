/**
 * Contract completeness — the emitted `contract.json` declares every table,
 * native enum, and role the reference version of Supabase ships in `auth`
 * and `storage`. Table/enum names are hardcoded (not derived from the
 * fixture) so this test pins the reference version
 * (supabase/postgres:17.6.1.106, gotrue v2.188.1, storage-api v1.54.1,
 * captured 2026-07-12 — see `test/fixtures/supabase-reference/schema.sql`)
 * and catches accidental omissions in `contract:generate`'s output.
 */
import { describe, expect, it } from 'vitest';
import contractJson from '../src/contract/contract.json' with { type: 'json' };
import { SupabaseRole } from '../src/contract/roles';

const AUTH_TABLES = [
  'audit_log_entries',
  'custom_oauth_providers',
  'flow_state',
  'identities',
  'instances',
  'mfa_amr_claims',
  'mfa_challenges',
  'mfa_factors',
  'oauth_authorizations',
  'oauth_client_states',
  'oauth_clients',
  'oauth_consents',
  'one_time_tokens',
  'refresh_tokens',
  'saml_providers',
  'saml_relay_states',
  'schema_migrations',
  'sessions',
  'sso_domains',
  'sso_providers',
  'users',
  'webauthn_challenges',
  'webauthn_credentials',
];

const STORAGE_TABLES = [
  'buckets',
  'buckets_analytics',
  'buckets_vectors',
  'iceberg_namespaces',
  'iceberg_tables',
  'migrations',
  'objects',
  's3_multipart_uploads',
  's3_multipart_uploads_parts',
  'vector_indexes',
];

const AUTH_NATIVE_ENUMS = [
  'aal_level',
  'code_challenge_method',
  'factor_status',
  'factor_type',
  'oauth_authorization_status',
  'oauth_client_type',
  'oauth_registration_type',
  'oauth_response_type',
  'one_time_token_type',
];

const STORAGE_NATIVE_ENUMS = ['buckettype'];

type ContractJsonNamespace = {
  entries: {
    table?: Record<string, unknown>;
    native_enum?: Record<string, unknown>;
    role?: Record<string, { control: string }>;
  };
};

type ContractJsonStorage = {
  namespaces: Record<string, ContractJsonNamespace>;
};

describe('contract completeness — auth/storage table, native enum, and role sets', () => {
  const storage = contractJson.storage as unknown as ContractJsonStorage;
  const auth = storage.namespaces['auth'];
  const storageNs = storage.namespaces['storage'];
  const unboundNs = storage.namespaces['__unbound__'];

  it('declares all 23 auth tables', () => {
    expect(Object.keys(auth?.entries.table ?? {}).sort()).toEqual([...AUTH_TABLES].sort());
  });

  it('declares all 10 storage tables', () => {
    expect(Object.keys(storageNs?.entries.table ?? {}).sort()).toEqual([...STORAGE_TABLES].sort());
  });

  it('declares all 9 auth native enums', () => {
    expect(Object.keys(auth?.entries.native_enum ?? {}).sort()).toEqual(
      [...AUTH_NATIVE_ENUMS].sort(),
    );
  });

  it('declares the 1 storage native enum', () => {
    expect(Object.keys(storageNs?.entries.native_enum ?? {}).sort()).toEqual(
      [...STORAGE_NATIVE_ENUMS].sort(),
    );
  });

  it('declares the three platform roles under external control', () => {
    const roles = unboundNs?.entries.role ?? {};
    expect(Object.keys(roles).sort()).toEqual([...SupabaseRole.values].sort());
    for (const roleName of SupabaseRole.values) {
      expect(roles[roleName]?.control).toBe('external');
    }
  });
});
