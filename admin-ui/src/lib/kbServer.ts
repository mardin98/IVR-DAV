/**
 * lib/kbServer.ts — Lógica server-side para el Admin UI
 * Solo se importa en API Routes (Node.js), nunca en componentes browser
 */

import { Firestore, FieldValue } from '@google-cloud/firestore';
import { SearchServiceClient, DocumentServiceClient } from '@google-cloud/discoveryengine';
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import type { KBArticle } from './kbClient';

const PROJECT_ID    = process.env.GCP_PROJECT_ID!;
const DATA_STORE_ID = process.env.VERTEX_SEARCH_DATASTORE_ID!;
const BUCKET_NAME   = process.env.KB_BUCKET_NAME || `${PROJECT_ID}-kb-documents`;
const LOCATION      = 'global';

const DOCUMENTS_PARENT = [
  `projects/${PROJECT_ID}`,
  `locations/${LOCATION}`,
  `collections/default_collection`,
  `dataStores/${DATA_STORE_ID}`,
  `branches/default_branch`,
].join('/');

const SERVING_CONFIG = [
  `projects/${PROJECT_ID}`,
  `locations/${LOCATION}`,
  `collections/default_collection`,
  `dataStores/${DATA_STORE_ID}`,
  `servingConfigs/default_serving_config`,
].join('/');

// Clientes GCP (singleton por módulo en Node.js)
const db             = new Firestore({ projectId: PROJECT_ID });
const documentClient = new DocumentServiceClient();
const searchClient   = new SearchServiceClient();
const storage        = new Storage({ projectId: PROJECT_ID });

const COLLECTION = 'knowledge_base';

// ── CRUD Artículos ──────────────────────────────────────────────────────────

export async function listArticles(): Promise<KBArticle[]> {
  const snap = await db.collection(COLLECTION).orderBy('updatedAt', 'desc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as KBArticle));
}

export async function getArticle(id: string): Promise<KBArticle | null> {
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as KBArticle;
}

export async function createArticle(
  data: Omit<KBArticle, 'id' | 'createdAt' | 'updatedAt'>
): Promise<KBArticle> {
  const id  = uuidv4();
  const now = new Date().toISOString();
  const article: KBArticle = { ...data, id, createdAt: now, updatedAt: now, usageCount: 0 };

  // 1. Guardar en Firestore
  await db.collection(COLLECTION).doc(id).set(article);

  // 2. Indexar en Vertex AI Search
  await indexInVertexAI(article);

  return article;
}

export async function updateArticle(id: string, data: Partial<KBArticle>): Promise<KBArticle> {
  const now = new Date().toISOString();
  const update = { ...data, updatedAt: now };

  await db.collection(COLLECTION).doc(id).update(update);

  const updated = await getArticle(id);
  if (!updated) throw new Error('Article not found after update');

  // Re-indexar en Vertex AI Search
  await indexInVertexAI(updated);

  return updated;
}

export async function deleteArticle(id: string): Promise<void> {
  // 1. Eliminar de Firestore
  await db.collection(COLLECTION).doc(id).delete();

  // 2. Eliminar del índice Vertex AI Search
  try {
    await documentClient.deleteDocument({
      name: `${DOCUMENTS_PARENT}/documents/${id}`,
    });
  } catch (e) {
    // Ignorar si no existía en el índice
    console.warn(`[KB] Documento ${id} no estaba en Vertex AI Search`);
  }
}

// ── Vertex AI Search ────────────────────────────────────────────────────────

async function indexInVertexAI(article: KBArticle): Promise<void> {
  if (!DATA_STORE_ID) {
    console.warn('[KB] VERTEX_SEARCH_DATASTORE_ID no configurado, skip indexación');
    return;
  }

  await documentClient.updateDocument({
    document: {
      id:   article.id,
      name: `${DOCUMENTS_PARENT}/documents/${article.id}`,
      structData: {
        fields: {
          title:     { stringValue: article.title },
          content:   { stringValue: article.content },
          category:  { stringValue: article.category },
          keywords:  { stringValue: article.keywords.join(', ') },
          updatedAt: { stringValue: article.updatedAt },
        },
      },
    },
    allowMissing: true,
  });
}

export async function searchKB(query: string) {
  if (!DATA_STORE_ID) return { results: [], responseTime: 0 };

  const start = Date.now();
  const [response] = await searchClient.search({
    servingConfig: SERVING_CONFIG,
    query,
    pageSize: 5,
    contentSearchSpec: {
      snippetSpec: { returnSnippet: true, maxSnippetCount: 2 },
    },
  });

  const results = (response.results || []).map(r => {
    const data = (r.document?.structData?.fields || {}) as Record<string, { stringValue?: string }>;
    return {
      id:      r.document?.id || '',
      title:   data.title?.stringValue   || '',
      content: data.content?.stringValue || '',
      score:   0,
    };
  });

  return { results, responseTime: Date.now() - start };
}

// ── File Upload a Cloud Storage ──────────────────────────────────────────────

export async function uploadFileToBucket(
  buffer: Buffer,
  originalName: string,
  mimetype: string,
  category: string
): Promise<{ id: string; filename: string; gcsUri: string }> {
  const id       = uuidv4();
  const ext      = originalName.split('.').pop() || 'bin';
  const filename = `${category}/${id}.${ext}`;

  const bucket = storage.bucket(BUCKET_NAME);
  const file   = bucket.file(filename);

  await file.save(buffer, {
    contentType: mimetype,
    metadata: { category, originalName, uploadedAt: new Date().toISOString() },
  });

  const gcsUri = `gs://${BUCKET_NAME}/${filename}`;

  // Crear entrada en Firestore para tracking
  await db.collection('kb_files').doc(id).set({
    id,
    filename,
    originalName,
    gcsUri,
    category,
    uploadedAt: new Date().toISOString(),
    indexed: false, // Vertex AI lo indexa con un delay
  });

  console.log(`[KB] Archivo subido: ${gcsUri}`);
  return { id, filename, gcsUri };
}
