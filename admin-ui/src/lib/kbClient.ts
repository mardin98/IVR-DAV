// lib/kbClient.ts — Cliente para las API routes del Admin UI
// Usado desde los componentes React (browser)

export interface KBArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  keywords: string[];
  createdAt: string;
  updatedAt: string;
  usageCount?: number;
  lastUsedAt?: string;
}

export interface KBTestResult {
  query: string;
  results: Array<{ id: string; title: string; content: string; score?: number }>;
  responseTime: number;
}

async function req(path: string, method = 'GET', body?: object) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export const KBClient = {
  // Artículos
  list:   (): Promise<KBArticle[]>                 => req('/articles'),
  get:    (id: string): Promise<KBArticle>         => req(`/articles/${id}`),
  create: (data: Omit<KBArticle, 'id' | 'createdAt' | 'updatedAt'>): Promise<KBArticle>
                                                   => req('/articles', 'POST', data),
  update: (id: string, data: Partial<KBArticle>): Promise<KBArticle>
                                                   => req(`/articles/${id}`, 'PUT', data),
  delete: (id: string): Promise<void>              => req(`/articles/${id}`, 'DELETE'),

  // Test de query
  test: (query: string): Promise<KBTestResult>     => req('/test', 'POST', { query }),

  // Upload (usa FormData, no JSON)
  async upload(file: File, category: string): Promise<{ id: string; filename: string }> {
    const form = new FormData();
    form.append('file', file);
    form.append('category', category);
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    if (!res.ok) throw new Error(`Upload error: ${res.status}`);
    return res.json();
  },
};
