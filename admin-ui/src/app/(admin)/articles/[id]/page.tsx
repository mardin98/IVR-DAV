// app/(admin)/articles/[id]/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { KBClient, type KBArticle } from '@/lib/kbClient';
import { ArticleEditor } from '@/components/ArticleEditor';

export default function EditArticlePage() {
  const { id } = useParams() as { id: string };
  const router  = useRouter();
  const [article, setArticle] = useState<KBArticle | null>(null);

  useEffect(() => { KBClient.get(id).then(setArticle); }, [id]);

  if (!article) return <div className="p-6 text-text-dim text-sm">Cargando...</div>;

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="font-display font-bold text-xl text-text mb-5">Editar artículo</h1>
      <div className="card p-5">
        <ArticleEditor
          initial={article}
          onSaved={() => router.push('/dashboard')}
          onCancel={() => router.push('/dashboard')}
        />
      </div>
    </div>
  );
}
