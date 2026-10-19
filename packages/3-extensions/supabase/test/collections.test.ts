import { contractFromJson } from '@internal/postgres/static';
import { Collection } from '@internal/sql-orm-client';
import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import supabase from '../src/runtime/supabase';
import type { Contract } from './fixtures/example-app/contract';
import contractJson from './fixtures/example-app/contract.json' with { type: 'json' };

class ProfileCollection extends Collection<Contract, 'Profile'> {
  named(username: string) {
    return this.where({ username });
  }
}

const contract = contractFromJson<Contract>(contractJson);
const jwtSecret = 'fixture-jwt-signing-input-not-a-real-credential';

describe('a supabase client with custom collection classes', () => {
  it('gives every role-bound client the classes', async () => {
    const db = await supabase({ contract, jwtSecret, collections: { Profile: ProfileCollection } });
    const jwt = await new SignJWT({ sub: 'user-1', role: 'authenticated' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(jwtSecret));
    const user = await db.asUser(jwt);

    expect({
      user: user.orm.public.Profile.named('ada') instanceof ProfileCollection,
      anon: db.asAnon().orm.public.Profile.named('ada') instanceof ProfileCollection,
      serviceRole: db.asServiceRole().orm.public.Profile.named('ada') instanceof ProfileCollection,
    }).toEqual({ user: true, anon: true, serviceRole: true });
    await db.close();
  });
});
