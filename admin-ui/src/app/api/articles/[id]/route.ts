// app/api/articles/[id]/route.ts — GET, PUT, DELETE por ID
import { NextResponse } from 'next/server';
import { getArticle, updateArticle, deleteArticle } from '@/lib/kbServer';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const article = await getArticle(params.id);
  if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(article);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body    = await req.json();
    const updated = await updateArticle(params.id, body);
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    await deleteArticle(params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
