// app/api/export/route.ts
import { NextResponse } from 'next/server';
import { exportCSV } from '@/lib/firestoreMetrics';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '30');
    const csv  = await exportCSV(days);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="callmanager-metrics-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
