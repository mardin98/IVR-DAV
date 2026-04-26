// app/api/realtime/route.ts
import { NextResponse } from 'next/server';
import { getRealtimeMetrics } from '@/lib/firestoreMetrics';

export async function GET() {
  try {
    const data = await getRealtimeMetrics();
    return NextResponse.json(data || {});
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
