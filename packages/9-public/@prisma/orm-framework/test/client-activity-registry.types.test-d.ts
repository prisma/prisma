import type {
  ClientActivityResult,
  CrossFamilyMiddleware,
} from '@prisma/orm-framework/components/runtime';
import { expectTypeOf, test } from 'vitest';

declare module '@prisma/orm-framework/components/runtime' {
  interface ClientActivityRegistry {
    'published-call': { result: { readonly published: true } };
  }
}

test('a kind registered through the published entry types its result', () => {
  expectTypeOf<ClientActivityResult<'published-call'>>().toEqualTypeOf<{
    readonly published: true;
  }>();
  expectTypeOf<ClientActivityResult<'other-call'>>().toEqualTypeOf<unknown>();
});

test('a middleware narrows on the registered kind through the published entry', () => {
  const middleware: CrossFamilyMiddleware = {
    name: 'published',
    async activityStarted(activity) {
      if (activity.kind === 'published-call') {
        expectTypeOf(activity.contentHash).toEqualTypeOf<string>();
      }
    },
  };
  void middleware;
});
