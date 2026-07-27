import type { Varchar } from '@prisma-next/target-postgres/codec-types';
import { blindCast } from '@prisma-next/utils/casts';
import { describe, expect, it } from 'vitest';
import { timeouts, withPostgresPort } from '../../../_harness/postgres';
import type { Contract } from './_fixture/generated/contract';
import contractJson from './_fixture/generated/contract.json' with { type: 'json' };

// Port of prisma/prisma@a6d0155 packages/client/tests/functional/issues/27511-include-enum-array
// (postgres only).
//
// Subject: findMany with include over a M:N relation when a model has an
// enum-array column (`permissions workspace_permission[]`) returns the correct data.
//
// Schema note: upstream uses implicit M:N (workspace_member.roles / workspace_role.members).
// prisma-next requires explicit junction models; the faithful port introduces
// `workspace_member_role` as the junction table.
//
// EMITTER GAP: `workspace_role.permissions` is a `workspace_permission[]`
// (text-backed enum list). The postgres emitter emits an invalid
// CHECK constraint (`permissions IN ('HELLO','WORLD')`) for array columns —
// the same gap as the enum-array and default-selection suites. The contract
// push fails with sqlState 22P02 ("malformed array literal") before any ORM
// operation runs, so this test fails at setup.
//
// The id fields are VarChar(30) → Varchar<30> branded type. blindCast is used
// to pass literal strings as the correct branded type.
//
// Disposition:
//   'findMany with include on many-to-many relationship with enum array should work'
//   → it.fails (enum[] emitter gap; push fails before any ORM query)

describe('ports/prisma/functional/issues-27511-include-enum-array', () => {
  it.fails(
    'findMany with include on many-to-many relationship with enum array should work',
    () =>
      withPostgresPort<Contract>({ contractJson }, async ({ db }) => {
        const roleId = blindCast<Varchar<30>, 'varchar id literal for it.fails test'>('role-1');
        const memberId = blindCast<Varchar<30>, 'varchar id literal for it.fails test'>('member-1');

        await db.public.workspace_role.create({
          id: roleId,
          name: 'Editor',
          permissions: ['HELLO', 'WORLD'],
        });
        await db.public.workspace_member.create({ id: memberId });
        await db.public.workspace_member_role.create({
          memberId,
          roleId,
        });

        const result = await db.public.workspace_member
          .include('roles', (roles) =>
            roles.include('role', (role) => role.select('name', 'permissions')),
          )
          .all();

        expect(result).toMatchObject([
          {
            roles: [
              {
                role: {
                  name: 'Editor',
                  permissions: ['HELLO', 'WORLD'],
                },
              },
            ],
          },
        ]);
      }),
    timeouts.spinUpPpgDev,
  );
});
