// app/api/upload/route.ts — Subir PDF/DOCX a Cloud Storage
import { NextResponse } from 'next/server';
import { uploadFileToBucket } from '@/lib/kbServer';

export async function POST(req: Request) {
  try {
    const form     = await req.formData();
    const file     = form.get('file') as File | null;
    const category = (form.get('category') as string) || 'general';

    if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });

    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'Solo se permiten PDF, DOCX y TXT' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB máximo
      return NextResponse.json({ error: 'Archivo demasiado grande (máx 10MB)' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadFileToBucket(buffer, file.name, file.type, category);

    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
