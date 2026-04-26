'use client';

// ── KPICard.tsx ─────────────────────────────────────────────────────────────
import { type LucideIcon } from 'lucide-react';
import clsx from 'clsx';

interface KPICardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  color: 'cyan' | 'green' | 'orange' | 'red' | 'blue' | 'amber';
  trend?: number;       // positivo = bueno, negativo = malo
}

const COLOR_MAP = {
  cyan:   { text: 'text-accent-cyan',   bg: 'bg-accent-cyan/10',   border: 'border-accent-cyan/20' },
  green:  { text: 'text-accent-green',  bg: 'bg-accent-green/10',  border: 'border-accent-green/20' },
  orange: { text: 'text-accent-orange', bg: 'bg-accent-orange/10', border: 'border-accent-orange/20' },
  red:    { text: 'text-accent-red',    bg: 'bg-accent-red/10',    border: 'border-accent-red/20' },
  blue:   { text: 'text-accent-blue',   bg: 'bg-accent-blue/10',   border: 'border-accent-blue/20' },
  amber:  { text: 'text-accent-amber',  bg: 'bg-accent-amber/10',  border: 'border-accent-amber/20' },
};

export function KPICard({ label, value, sub, icon: Icon, color, trend }: KPICardProps) {
  const c = COLOR_MAP[color];
  return (
    <div className="card px-5 py-4">
      <div className="flex items-start justify-between mb-3">
        <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center border', c.bg, c.border)}>
          <Icon className={clsx('w-4 h-4', c.text)} />
        </div>
        {trend !== undefined && (
          <span className={clsx('mono text-xs px-1.5 py-0.5 rounded', {
            'text-accent-green bg-accent-green/10': trend >= 0,
            'text-accent-red bg-accent-red/10':     trend < 0,
          })}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className={clsx('font-display font-bold text-3xl mb-0.5', c.text)}>{value}</div>
      <div className="label">{label}</div>
      {sub && <div className="text-text-dim text-xs mt-0.5">{sub}</div>}
    </div>
  );
}
