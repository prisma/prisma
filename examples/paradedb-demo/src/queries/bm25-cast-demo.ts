import { db } from '../prisma/db';

export async function bm25CastDemo() {
  const runtime = db.runtime();

  const boosted = await runtime.execute(
    db.sql.public.item
      .select('id', 'description')
      .select('score', (f, fns) => fns.paradeDbScore(f.id))
      .where((f, fns) => fns.paradeDbMatchAny(f.description, fns.paradeDbBoost('keyboard', 5)))
      .orderBy((f, fns) => fns.paradeDbScore(f.id), { direction: 'desc' })
      .limit(3)
      .build(),
  );

  const constScored = await runtime.execute(
    db.sql.public.item
      .select('id', 'description')
      .select('score', (f, fns) => fns.paradeDbScore(f.id))
      .where((f, fns) => fns.paradeDbMatchAny(f.description, fns.paradeDbConst('keyboard', 1)))
      .orderBy((f, fns) => fns.paradeDbScore(f.id), { direction: 'desc' })
      .limit(3)
      .build(),
  );

  const phraseSlop = await runtime.execute(
    db.sql.public.item
      .select('id', 'description')
      .where((f, fns) => fns.paradeDbPhrase(f.description, fns.paradeDbSlop('cooling fan', 1)))
      .limit(3)
      .build(),
  );

  return { boosted, constScored, phraseSlop };
}
