'use client';

import { useState } from 'react';
import { KBClient, type KBTestResult } from '@/lib/kbClient';
import { Search, Clock, ChevronDown, ChevronUp } from 'lucide-react';

export function KBTestPanel() {
  const [query,    setQuery]    = useState('');
  const [result,   setResult]   = useState<KBTestResult | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const EXAMPLES = [
    '¿Cómo consulto el saldo de mi cuenta?',
    '¿Qué hago si no reconozco un cargo en mi tarjeta?',
    '¿Cuáles son los requisitos para un préstamo personal?',
    '¿Cómo hago una transferencia internacional?',
  ];

  async function handleTest(q = query) {
    if (!q.trim()) return;
    setQuery(q);
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await KBClient.test(q);
      setResult(res);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Query input */}
      <div className="flex flex-col gap-2">
        <label className="label">Query de prueba</label>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleTest()}
            placeholder="Escribir lo que preguntaría un cliente..."
            className="flex-1 bg-surface-0 border border-border rounded-lg px-3 py-2.5 text-sm text-text
                       placeholder:text-text-dim focus:outline-none focus:border-accent-cyan transition-colors"
          />
          <button
            onClick={() => handleTest()}
            disabled={loading || !query.trim()}
            className="btn-primary flex items-center gap-2 px-4"
          >
            <Search className="w-4 h-4" />
            {loading ? 'Buscando...' : 'Probar'}
          </button>
        </div>

        {/* Ejemplos rápidos */}
        <div className="flex flex-wrap gap-1.5">
          <span className="mono text-text-dim text-xs self-center">Ejemplos:</span>
          {EXAMPLES.map(ex => (
            <button
              key={ex}
              onClick={() => handleTest(ex)}
              className="text-xs text-text-dim border border-border rounded-full px-2.5 py-1
                         hover:border-border-2 hover:text-text-mid transition-all"
            >
              {ex.length > 40 ? ex.slice(0, 38) + '…' : ex}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="text-accent-red text-sm bg-red-500/8 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Resultados */}
      {result && (
        <div className="flex flex-col gap-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="label">
              {result.results.length} resultado(s) encontrado(s)
            </span>
            <span className="mono text-text-dim text-xs flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {result.responseTime}ms
            </span>
          </div>

          {result.results.length === 0 ? (
            <div className="card p-6 text-center text-text-dim text-sm">
              No se encontraron artículos relevantes para esta query.
              <br />
              <span className="text-xs mt-1 block">
                Considera agregar artículos o ajustar las keywords.
              </span>
            </div>
          ) : (
            result.results.map((r, i) => (
              <div key={r.id} className="card overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-2 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="mono text-text-dim text-xs">#{i + 1}</span>
                    <span className="text-sm font-semibold text-text">{r.title}</span>
                  </div>
                  {expanded === r.id
                    ? <ChevronUp className="w-4 h-4 text-text-dim" />
                    : <ChevronDown className="w-4 h-4 text-text-dim" />
                  }
                </button>
                {expanded === r.id && (
                  <div className="px-4 pb-4 border-t border-border">
                    <p className="text-sm text-text-mid leading-relaxed mt-3 whitespace-pre-wrap">
                      {r.content}
                    </p>
                    <p className="mono text-text-dim text-xs mt-2">ID: {r.id}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
