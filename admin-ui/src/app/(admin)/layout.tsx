// app/(admin)/layout.tsx — Layout con sidebar para todas las páginas admin
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Plus, Upload, TestTube, LayoutDashboard, LogOut } from 'lucide-react';
import clsx from 'clsx';

const NAV = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Artículos' },
  { href: '/articles/new', icon: Plus,         label: 'Nuevo artículo' },
  { href: '/upload',    icon: Upload,          label: 'Subir archivos' },
  { href: '/test',      icon: TestTube,        label: 'Probar KB' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-56 bg-surface-1 border-r border-border flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center gap-2 mb-0.5">
            <BookOpen className="w-4 h-4 text-accent-cyan" />
            <span className="font-display font-bold text-sm text-text">KB Admin</span>
          </div>
          <span className="mono text-text-dim text-xs">Call Manager AI</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5">
          {NAV.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all',
                path === href || (href !== '/dashboard' && path.startsWith(href))
                  ? 'bg-surface-2 border border-border-2 text-accent-cyan'
                  : 'text-text-dim hover:text-text-mid hover:bg-surface-2'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-2 py-3 border-t border-border">
          <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-text-dim
                             hover:text-text-mid w-full transition-all">
            <LogOut className="w-3.5 h-3.5" />
            Salir
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
