import { Collection } from '@prisma/orm-postgres/orm-client';
import type { Contract } from '../prisma/contract.d';

export class UserCollection extends Collection<Contract, 'User'> {
  admins() {
    return this.where({ kind: 'admin' });
  }

  newestFirst() {
    return this.orderBy((user) => user.createdAt.desc());
  }
}

export class PostCollection extends Collection<Contract, 'Post'> {
  forUser(userId: string) {
    return this.where({ userId });
  }

  newestFirst() {
    return this.orderBy((post) => post.createdAt.desc());
  }
}

// Note: a `TaskCollection` would mirror the demo, but `Task` queries fail
// against the discriminated schema (`column "bug.id" does not exist`); the
// class-table-inheritance code path is broken at the ORM layer and tracked
// as pre-existing drift in M3 R2 — wire it in when the framework supports it.
