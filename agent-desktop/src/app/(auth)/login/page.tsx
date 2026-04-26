'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/dashboard');
    } catch {
      setError('Credenciales incorrectas. Verificar email y contraseña.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-0">
      {/* Grid background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(0,229,255,.06) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative z-10 w-full max-w-sm px-4">
        {/* Logo / header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-surface-1 border border-border rounded-full px-4 py-1.5 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse-slow" />
            <span className="mono text-text-dim tracking-widest">CALL MANAGER AI</span>
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-text mb-1">
            Agent Desktop
          </h1>
          <p className="text-text-mid text-sm">Davivienda — Centro de Atención</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="card p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="label">Correo corporativo</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="agente@davivienda.com"
              className="bg-surface-0 border border-border rounded-lg px-3 py-2.5 text-sm text-text
                         placeholder:text-text-dim focus:outline-none focus:border-accent-cyan
                         transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="label">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="bg-surface-0 border border-border rounded-lg px-3 py-2.5 text-sm text-text
                         placeholder:text-text-dim focus:outline-none focus:border-accent-cyan
                         transition-colors"
            />
          </div>

          {error && (
            <p className="text-accent-red text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-1 py-2.5"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p className="text-center text-text-dim text-xs mt-4">
          ¿Problemas de acceso? Contactar a soporte TI
        </p>
      </div>
    </div>
  );
}
