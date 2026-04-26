// app/layout.tsx
import type { Metadata } from 'next';
import { DM_Sans, DM_Mono, Syne } from 'next/font/google';
import './globals.css';

const body    = DM_Sans({ subsets: ['latin'], variable: '--font-body' });
const mono    = DM_Mono({ subsets: ['latin'], weight: ['400','500'], variable: '--font-mono' });
const display = Syne({ subsets: ['latin'], variable: '--font-display' });

export const metadata: Metadata = {
  title: 'Call Manager — Agent Desktop',
  description: 'Panel de agentes Davivienda',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${body.variable} ${mono.variable} ${display.variable}`}>
      <body className="bg-surface-0 text-text font-sans antialiased">
        {/* Elemento de audio oculto para el softphone JsSIP */}
        <audio id="remote-audio" autoPlay playsInline className="hidden" />
        {children}
      </body>
    </html>
  );
}
