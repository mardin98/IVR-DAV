// app/(admin)/test/page.tsx
'use client';
import { KBTestPanel } from '@/components/KBTestPanel';

export default function TestPage() {
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="font-display font-bold text-xl text-text mb-1">Probar Knowledge Base</h1>
      <p className="text-text-mid text-sm mb-5">
        Simulá una pregunta de cliente y verificá qué artículos devuelve Vertex AI Search.
      </p>
      <div className="card p-5">
        <KBTestPanel />
      </div>
    </div>
  );
}
