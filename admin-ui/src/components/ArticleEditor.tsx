'use client';

import { useState } from 'react';
import { KBClient, type KBArticle } from '@/lib/kbClient';
import { Save, X, Plus } from 'lucide-react';
import clsx from 'clsx';

const CATEGORIES = ['cuentas', 'tarjetas', 'prestamos', 'transferencias', 'servicios', 'seguridad', 'general'];

interface ArticleEditorProps {
  initial?: Partial<KBArticle>;
  onSaved: (article: KBArticle) => void;
  onCancel: () => void;
}

export function ArticleEditor({ initial, onSaved, onCancel }: ArticleEditorProps) {
  const [title,    setTitle]    = useState(initial?.title    || '');
  const [content,  setContent]  = useState(initial?.content  || '');
  const [category, setCategory] = useState(initial?.category || 'general');
  const [keywords, setKeywords] = useState<string[]>(initial?.keywords || []);
  const [kw,       setKw]       = useState('');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  function addKeyword() {
    const trimmed = kw.trim().toLowerCase();
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords([...keywords, trimmed]);
    }
    setKw('');
  }

  function removeKeyword(k: string) {
    setKeywords(keywords.filter(x => x !== k));
  }

  async function handleSave() {
    if (!title.trim() || !content.trim()) {
      setError('Título y contenido son requeridos');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const saved = initial?.id
        ? await KBClient.update(initial.id, { title, content, category, keywords })
        : await KBClient.create({ title, content, category, keywords });
      onSaved(saved);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Título */}
      <div className="flex flex-col gap-1.5">
        <label className="label">Título del artículo</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Ej: Cómo consultar el saldo de mi cuenta"
          className="bg-surface-0 border border-border rounded-lg px-3 py-2.5 text-sm text-text
                     placeholder:text-text-dim focus:outline-none focus:border-accent-cyan transition-colors"
        />
      </div>

      {/* Categoría */}
      <div className="flex flex-col gap-1.5">
        <label className="label">Categoría</label>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="bg-surface-0 border border-border rounded-lg px-3 py-2.5 text-sm text-text
                     focus:outline-none focus:border-accent-cyan transition-colors"
        >
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Contenido */}
      <div className="flex flex-col gap-1.5">
        <label className="label">Contenido</label>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Escribir el contenido completo del artículo. El bot IA usará este texto para responder a los clientes..."
          rows={10}
          className="bg-surface-0 border border-border rounded-lg px-3 py-3 text-sm text-text
                     placeholder:text-text-dim focus:outline-none focus:border-accent-cyan
                     transition-colors resize-none leading-relaxed"
        />
        <span className="mono text-text-dim text-right">{content.length} caracteres</span>
      </div>

      {/* Keywords */}
      <div className="flex flex-col gap-1.5">
        <label className="label">Palabras clave (ayudan a la búsqueda)</label>
        <div className="flex gap-2">
          <input
            value={kw}
            onChange={e => setKw(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
            placeholder="Escribir y presionar Enter"
            className="flex-1 bg-surface-0 border border-border rounded-lg px-3 py-2 text-sm text-text
                       placeholder:text-text-dim focus:outline-none focus:border-accent-cyan transition-colors"
          />
          <button onClick={addKeyword} className="btn-ghost px-3 py-2">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {keywords.map(k => (
              <span key={k} className="flex items-center gap-1 bg-surface-2 border border-border
                                       rounded-full px-2.5 py-0.5 text-xs text-text-mid">
                {k}
                <button onClick={() => removeKeyword(k)} className="text-text-dim hover:text-accent-red">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="text-accent-red text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Acciones */}
      <div className="flex gap-2 pt-2">
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
          <Save className="w-4 h-4" />
          {saving ? 'Guardando...' : (initial?.id ? 'Actualizar' : 'Crear artículo')}
        </button>
        <button onClick={onCancel} className="btn-ghost">
          Cancelar
        </button>
      </div>
    </div>
  );
}
