// app/api/test/route.ts — Probar query contra KB
import { NextResponse } from 'next/server';
import { searchKB } from '@/lib/kbServer';

export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    if (!query?.trim()) return NextResponse.json({ error: 'query requerido' }, { status: 400 });
    const result = await searchKB(query);
    return NextResponse.json({ query, ...result });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
