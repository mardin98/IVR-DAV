// app/api/metrics/route.ts
import { NextResponse } from 'next/server';
import { getDashboardKPIs } from '@/lib/firestoreMetrics';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '7');
    const data = await getDashboardKPIs(Math.min(Math.max(days, 1), 90));
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
