import { NextResponse } from 'next/server';
import { findLocations } from '../../../src/data/locations';
import { getDb } from '../../../src/db';

export async function GET() {
  const db = await getDb();
  const locations = await findLocations(db);
  return NextResponse.json(locations);
}
