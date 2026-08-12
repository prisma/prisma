import 'dotenv/config';
import { loadAppConfig } from '../src/app-config';
import { db } from '../src/prisma/db';

const items: ReadonlyArray<{
  readonly id: number;
  readonly description: string;
  readonly category: string;
  readonly rating: number;
}> = [
  {
    id: 1,
    description: 'Ergonomic mesh office chair with lumbar support',
    category: 'furniture',
    rating: 5,
  },
  {
    id: 2,
    description: 'Wireless mechanical keyboard with RGB lighting',
    category: 'electronics',
    rating: 4,
  },
  {
    id: 3,
    description: 'Stainless steel electric kettle 1.7 liters',
    category: 'kitchen',
    rating: 5,
  },
  {
    id: 4,
    description: 'Noise cancelling over-ear headphones',
    category: 'electronics',
    rating: 5,
  },
  {
    id: 5,
    description: 'Ultralight backpacking tent for two people',
    category: 'outdoors',
    rating: 4,
  },
  {
    id: 6,
    description: 'Laptop stand with cooling fan and USB hub',
    category: 'electronics',
    rating: 3,
  },
  { id: 7, description: 'Cast iron skillet 12 inch pre-seasoned', category: 'kitchen', rating: 5 },
  { id: 8, description: 'Running shoes with carbon plate midsole', category: 'sports', rating: 4 },
  { id: 9, description: 'Standing desk converter for laptops', category: 'furniture', rating: 4 },
  {
    id: 10,
    description: 'Insulated water bottle keeps cold 24 hours',
    category: 'outdoors',
    rating: 5,
  },
];

async function main() {
  const { databaseUrl } = loadAppConfig();
  const runtime = await db.connect({ url: databaseUrl });

  try {
    for (const item of items) {
      await runtime.execute(db.sql.public.item.insert([item]).build());
    }
    console.log(`Seeded ${items.length} items`);
  } finally {
    await runtime.close();
  }
}

main().catch((e) => {
  console.error('Error seeding database:', e);
  process.exitCode = 1;
});
