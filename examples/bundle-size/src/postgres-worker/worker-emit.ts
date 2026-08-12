import postgresServerless from '@prisma/orm-postgres/serverless';
import type { Contract } from '../postgres/generated/contract.d';
import contractJson from '../postgres/generated/contract.json' with { type: 'json' };

const db = postgresServerless<Contract>({ contractJson });

interface Env {
  readonly DATABASE_URL: string;
}

export default {
  async fetch(_request: Request, env: Env): Promise<Response> {
    await using runtime = await db.connect({ url: env.DATABASE_URL });
    const notes = await runtime.execute(db.sql.public.Note.select('id').limit(10).build());
    return Response.json({ notes });
  },
};
