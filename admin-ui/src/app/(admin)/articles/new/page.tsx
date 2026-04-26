// app/(admin)/articles/new/page.tsx
'use client';
import { useRouter } from 'next/navigation';
import { ArticleEditor } from '@/components/ArticleEditor';

export default function NewArticlePage() {
  const router = useRouter();
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="font-display font-bold text-xl text-text mb-5">Nuevo artículo</h1>
      <div className="card p-5">
        <ArticleEditor
          onSaved={() => router.push('/dashboard')}
          onCancel={() => router.push('/dashboard')}
        />
      </div>
    </div>
  );
}
