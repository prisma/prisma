import { describe, expect, it } from 'vitest';
import { detectionPatterns } from '../guide-detections';

const GUIDE_PATHS = {
  app: 'skills/prisma-8/upgrading/app/upgrades/8.0.0-rc.18-to-8.0.0-rc.19/instructions.md',
  extension:
    'skills/prisma-8/upgrading/extension/upgrades/8.0.0-rc.18-to-8.0.0-rc.19/instructions.md',
} as const;

function detects(audience: keyof typeof GUIDE_PATHS, content: string): boolean {
  return detectionPatterns(GUIDE_PATHS[audience], 'client-takes-contract-value').some((pattern) =>
    pattern.test(content),
  );
}

describe.each(['app', 'extension'] as const)(
  '%s client-takes-contract-value detection of a client imported under another name',
  (audience) => {
    it.each([
      [
        'a default import beside named imports',
        "import ormPostgresRuntime, {\n  type PostgresClient,\n} from '@prisma/orm-postgres/runtime';\n\nfunction build() {\n  return ormPostgresRuntime<OrmContractOf<C>>({\n    ...options,\n    contractJson: contract.__cmp.contractJson,\n  });\n}",
      ],
      [
        'a renamed named import',
        "import { mongoQuery as query } from '@prisma/orm-mongo/query-builder';\nconst q = query<Contract>({ contractJson });",
      ],
    ])('finds %s', (_name, content) => {
      expect(detects(audience, content)).toBe(true);
    });

    it.each([
      [
        'the renamed client given a contract value',
        "import ormPostgresRuntime from '@prisma/orm-postgres/runtime';\nconst db = ormPostgresRuntime({ contract, url });",
      ],
      [
        'a function from another module',
        "import build from './build';\nconst db = build({ contractJson });",
      ],
    ])('skips %s', (_name, content) => {
      expect(detects(audience, content)).toBe(false);
    });
  },
);
