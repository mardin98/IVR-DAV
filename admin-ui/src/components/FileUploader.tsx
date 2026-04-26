'use client';

// ── FileUploader.tsx ────────────────────────────────────────────────────────
import { useState, useRef } from 'react';
import { KBClient } from '@/lib/kbClient';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

const CATEGORIES = ['cuentas', 'tarjetas', 'prestamos', 'transferencias', 'servicios', 'seguridad', 'general'];

interface FileUploaderProps {
  onUploaded?: (id: string, filename: string) => void;
}

export function FileUploader({ onUploaded }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging,  setDragging]  = useState(false);
  const [category,  setCategory]  = useState('general');
  const [uploading, setUploading] = useState(false);
  const [status,    setStatus]    = useState<'idle' | 'success' | 'error'>('idle');
  const [message,   setMessage]   = useState('');

  async function handleFile(file: File) {
    setUploading(true);
    setStatus('idle');
    try {
      const result = await KBClient.upload(file, category);
      setStatus('success');
      setMessage(`"${file.name}" subido correctamente. Vertex AI indexará el documento en ~2 minutos.`);
      onUploaded?.(result.id, result.filename);
    } catch (e) {
      setStatus('error');
      setMessage(String(e));
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Selector de categoría */}
      <div className="flex flex-col gap-1.5">
        <label className="label">Categoría del documento</label>
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

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={clsx(
          'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all',
          dragging
            ? 'border-accent-cyan bg-accent-cyan/5'
            : 'border-border hover:border-border-2 hover:bg-surface-2'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        <Upload className={clsx('w-8 h-8 mx-auto mb-3', dragging ? 'text-accent-cyan' : 'text-text-dim')} />
        <p className="text-sm text-text-mid">
          {uploading ? 'Subiendo...' : 'Arrastrar archivo aquí o clic para seleccionar'}
        </p>
        <p className="mono text-text-dim text-xs mt-1">PDF, DOCX, TXT — máx 10MB</p>
      </div>

      {/* Status */}
      {status !== 'idle' && (
        <div className={clsx('flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm border', {
          'bg-green-500/8 border-green-500/20 text-accent-green': status === 'success',
          'bg-red-500/8 border-red-500/20 text-accent-red':       status === 'error',
        })}>
          {status === 'success'
            ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          }
          {message}
        </div>
      )}

      {/* Info */}
      <div className="card px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-4 h-4 text-accent-blue" />
          <span className="text-sm font-semibold text-text">¿Cómo funciona la indexación?</span>
        </div>
        <p className="text-xs text-text-mid leading-relaxed">
          El archivo se sube a Cloud Storage. Vertex AI Search lo indexa automáticamente en ~2 minutos.
          El bot IA podrá usarlo en nuevas conversaciones sin necesidad de reiniciar nada.
        </p>
      </div>
    </div>
  );
}
