// app/api/articles/route.ts — GET (list) + POST (create)
import { NextResponse } from 'next/server';
import { listArticles, createArticle } from '@/lib/kbServer';

export async function GET() {
  try {
    const articles = await listArticles();
    return NextResponse.json(articles);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, content, category, keywords } = body;
    if (!title || !content || !category) {
      return NextResponse.json({ error: 'title, content y category son requeridos' }, { status: 400 });
    }
    const article = await createArticle({
      title,
      content,
      category,
      keywords: keywords || [],
    });
    return NextResponse.json(article, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
