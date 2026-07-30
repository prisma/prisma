import { DEFAULT_CONTRACT_SOURCE_DIR } from '@prisma-next/config/config-types';
import {
  type ImportSpecifierResolver,
  keepInternalSpecifiers,
} from '@prisma-next/framework-components/emission';

export type TargetId = 'postgres' | 'mongo';
export type AuthoringId = 'psl' | 'typescript';

/**
 * The package name a scaffolded project depends on and imports from, for the
 * import root it is being scaffolded against. Every specifier in the scaffold
 * derives from this one, so the dependency `init` installs and the imports it
 * writes cannot disagree.
 */
export function targetPackageName(
  target: TargetId,
  resolveImportSpecifier: ImportSpecifierResolver = keepInternalSpecifiers,
): string {
  return resolveImportSpecifier(
    target === 'postgres' ? '@prisma-next/postgres' : '@prisma-next/mongo',
  );
}

/** One entrypoint of the scaffolded project's target package. */
export function targetEntrypoint(
  target: TargetId,
  subpath: string,
  resolveImportSpecifier: ImportSpecifierResolver = keepInternalSpecifiers,
): string {
  const internal = target === 'postgres' ? '@prisma-next/postgres' : '@prisma-next/mongo';
  return resolveImportSpecifier(`${internal}/${subpath}`);
}

export function targetLabel(target: TargetId): string {
  return target === 'postgres' ? 'PostgreSQL' : 'MongoDB';
}

export function defaultSchemaPath(authoring: AuthoringId): string {
  if (authoring === 'typescript') {
    return `${DEFAULT_CONTRACT_SOURCE_DIR}/contract.ts`;
  }
  return `${DEFAULT_CONTRACT_SOURCE_DIR}/contract.prisma`;
}

export function starterSchema(
  target: TargetId,
  authoring: AuthoringId,
  resolveImportSpecifier: ImportSpecifierResolver = keepInternalSpecifiers,
): string {
  if (authoring === 'typescript') {
    const builder = targetEntrypoint(target, 'contract-builder', resolveImportSpecifier);
    return target === 'mongo' ? starterSchemaTsMongo(builder) : starterSchemaTsPostgres(builder);
  }
  return target === 'mongo' ? starterSchemaPslMongo() : starterSchemaPslPostgres();
}

/**
 * Renders a short authoring-appropriate schema sample (FR5.1) for embedding
 * in `prisma-next.md`. Returns a complete fenced markdown code block.
 *
 * The sample intentionally shows just one model: it's illustrative, not
 * a substitute for the full scaffolded contract file. The TS samples use
 * the same outer shape as `starterSchemaTs*` (FR5.3) so a user reading
 * the doc and the file side-by-side sees the same structure.
 */
export function schemaSample(
  target: TargetId,
  authoring: AuthoringId,
  resolveImportSpecifier: ImportSpecifierResolver = keepInternalSpecifiers,
): string {
  if (authoring === 'typescript') {
    const builder = targetEntrypoint(target, 'contract-builder', resolveImportSpecifier);
    return target === 'mongo' ? schemaSampleTsMongo(builder) : schemaSampleTsPostgres(builder);
  }
  return target === 'mongo' ? schemaSamplePslMongo() : schemaSamplePslPostgres();
}

function schemaSamplePslPostgres(): string {
  return `\`\`\`prisma
model User {
  id       Int     @id @default(autoincrement())
  email    String  @unique
  username String?
  name     String?
}
\`\`\``;
}

function schemaSamplePslMongo(): string {
  return `\`\`\`prisma
model User {
  id       ObjectId @id @map("_id")
  email    String   @unique
  username String?
  name     String?
  @@map("users")
}
\`\`\``;
}

function schemaSampleTsPostgres(builder: string): string {
  return `\`\`\`typescript
import { defineContract } from '${builder}';

export const contract = defineContract(
  {},
  ({ field, model }) => ({
    models: {
      User: model('User', {
        fields: {
          id: field.id.uuidv7String(),
          email: field.text().unique(),
          username: field.text().optional(),
          name: field.text().optional(),
        },
      }),
    },
  }),
);
\`\`\``;
}

function schemaSampleTsMongo(builder: string): string {
  return `\`\`\`typescript
import { defineContract } from '${builder}';

export const contract = defineContract(
  {},
  ({ field, model }) => ({
    models: {
      User: model('User', {
        collection: 'users',
        fields: {
          _id: field.objectId(),
          email: field.string(),
          username: field.string().optional(),
          name: field.string().optional(),
        },
      }),
    },
  }),
);
\`\`\``;
}

function starterSchemaPslPostgres(): string {
  return `// use prisma-next

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  username  String?
  name      String?
  posts     Post[]
  createdAt DateTime @default(now())
  updatedAt temporal.updatedAt()
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  author    User     @relation(fields: [authorId], references: [id])
  authorId  Int
  createdAt DateTime @default(now())
  updatedAt temporal.updatedAt()
}
`;
}

function starterSchemaPslMongo(): string {
  return `// use prisma-next

model User {
  id       ObjectId @id @map("_id")
  email    String   @unique
  username String?
  name     String?
  posts    Post[]
  @@map("users")
}

model Post {
  id       ObjectId @id @map("_id")
  title    String
  content  String?
  author   User     @relation(fields: [authorId], references: [id])
  authorId ObjectId
  @@map("posts")
}
`;
}

function starterSchemaTsPostgres(builder: string): string {
  return `import { defineContract } from '${builder}';

export const contract = defineContract(
  {},
  ({ field, model, rel }) => ({
    models: {
      User: model('User', {
        fields: {
          id: field.id.uuidv7String(),
          email: field.text().unique(),
          username: field.text().optional(),
          name: field.text().optional(),
          createdAt: field.temporal.createdAt(),
          updatedAt: field.temporal.updatedAt(),
        },
        relations: {
          posts: rel.hasMany('Post', { by: 'authorId' }),
        },
      }),

      Post: model('Post', {
        fields: {
          id: field.id.uuidv7String(),
          title: field.text(),
          content: field.text().optional(),
          authorId: field.uuidString(),
          createdAt: field.temporal.createdAt(),
          updatedAt: field.temporal.updatedAt(),
        },
        relations: {
          author: rel.belongsTo('User', { from: 'authorId', to: 'id' }),
        },
      }),
    },
  }),
);
`;
}

function starterSchemaTsMongo(builder: string): string {
  return `import { defineContract } from '${builder}';

export const contract = defineContract(
  {},
  ({ field, model, rel }) => ({
    models: {
      User: model('User', {
        collection: 'users',
        fields: {
          _id: field.objectId(),
          email: field.string(),
          username: field.string().optional(),
          name: field.string().optional(),
        },
        relations: {
          posts: rel.hasMany('Post', { from: '_id', to: 'authorId' }),
        },
      }),

      Post: model('Post', {
        collection: 'posts',
        fields: {
          _id: field.objectId(),
          title: field.string(),
          content: field.string().optional(),
          authorId: field.objectId(),
        },
        relations: {
          author: rel.belongsTo('User', { from: 'authorId', to: '_id' }),
        },
      }),
    },
  }),
);
`;
}

export function configFile(
  target: TargetId,
  contractPath: string,
  resolveImportSpecifier: ImportSpecifierResolver = keepInternalSpecifiers,
): string {
  const configEntrypoint = targetEntrypoint(target, 'config', resolveImportSpecifier);
  return `import 'dotenv/config';
import { defineConfig } from '${configEntrypoint}';

export default defineConfig({
  contract: ${JSON.stringify(contractPath)},
  db: {
    connection: process.env['DATABASE_URL']!,
  },
});
`;
}

export function dbFile(
  target: TargetId,
  resolveImportSpecifier: ImportSpecifierResolver = keepInternalSpecifiers,
): string {
  const runtime = targetEntrypoint(target, 'runtime', resolveImportSpecifier);
  if (target === 'postgres') {
    return `import postgres from '${runtime}';
import type { Contract } from './contract.d';
import contractJson from './contract.json' with { type: 'json' };

export const db = postgres<Contract>({
  contractJson,
  url: process.env['DATABASE_URL']!,
});
`;
  }

  return `import mongo from '${runtime}';
import type { Contract } from './contract.d';
import contractJson from './contract.json' with { type: 'json' };

export const db = mongo<Contract>({
  contractJson,
  url: process.env['DATABASE_URL']!,
});
`;
}
