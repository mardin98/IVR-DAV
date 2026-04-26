// app/(admin)/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { KBClient, type KBArticle } from '@/lib/kbClient';
import { Plus, Trash2, Pencil, Activity, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const CAT_COLORS: Record<string, string> = {
  cuentas: 'text-accent-blue bg-accent-blue/10 border-accent-blue/20',
  tarjetas: 'text-accent-cyan bg-accent-cyan/10 border-accent-cyan/20',
  prestamos: 'text-accent-amber bg-accent-amber/10 border-accent-amber/20',
  transferencias: 'text-accent-green bg-accent-green/10 border-accent-green/20',
  servicios: 'text-accent-orange bg-accent-orange/10 border-accent-orange/20',
  seguridad: 'text-accent-red bg-accent-red/10 border-accent-red/20',
  general: 'text-text-mid bg-surface-2 border-border',
};

export default function DashboardPage() {
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');

  useEffect(() => {
    KBClient.list().then(setArticles).finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string, title: string) {
    if (!confirm(`¿Eliminar "${title}"? Esta acción no se puede deshacer.`)) return;
    await KBClient.delete(id);
    setArticles(articles.filter(a => a.id !== id));
  }

  const filtered = articles.filter(a =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 flex flex-col gap-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-xl text-text">Knowledge Base</h1>
          <p className="text-text-mid text-sm mt-0.5 mono">{articles.length} artículos indexados</p>
        </div>
        <Link href="/articles/new" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nuevo artículo
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: FileText,  label: 'Total artículos', value: articles.length, color: 'text-accent-cyan' },
          { icon: Activity,  label: 'Más usado',
            value: articles.sort((a,b) => (b.usageCount||0)-(a.usageCount||0))[0]?.title?.slice(0,20)+'…' || '—',
            color: 'text-accent-green' },
          { icon: Plus,      label: 'Sin categoría',
            value: articles.filter(a => a.category === 'general').length,
            color: 'text-accent-amber' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="card px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <span className="label">{label}</span>
              <Icon className={`w-3.5 h-3.5 ${color}`} />
            </div>
            <span className={`font-display font-bold text-lg ${color}`}>{value}</span>
          </div>
        ))}
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Buscar por título o categoría..."
        className="bg-surface-1 border border-border rounded-lg px-3 py-2.5 text-sm text-text
                   placeholder:text-text-dim focus:outline-none focus:border-accent-cyan transition-colors"
      />

      {/* Lista */}
      {loading ? (
        <div className="text-center text-text-dim text-sm py-10">Cargando artículos...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center text-text-dim text-sm">
          {search ? 'No hay artículos que coincidan.' : 'No hay artículos. Creá el primero.'}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(article => (
            <div key={article.id} className="card px-4 py-3 flex items-center gap-3 group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-text truncate">{article.title}</span>
                  <span className={`mono text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 ${CAT_COLORS[article.category] || CAT_COLORS.general}`}>
                    {article.category}
                  </span>
                </div>
                <div className="flex items-center gap-3 mono text-xs text-text-dim">
                  <span>Usado {article.usageCount || 0} veces</span>
                  <span>·</span>
                  <span>Actualizado {formatDistanceToNow(new Date(article.updatedAt), { locale: es })} atrás</span>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link href={`/articles/${article.id}`}
                  className="p-1.5 rounded-lg hover:bg-surface-2 text-text-dim hover:text-accent-cyan transition-colors">
                  <Pencil className="w-4 h-4" />
                </Link>
                <button onClick={() => handleDelete(article.id, article.title)}
                  className="p-1.5 rounded-lg hover:bg-surface-2 text-text-dim hover:text-accent-red transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
