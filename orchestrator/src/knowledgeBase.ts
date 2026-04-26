/**
 * knowledgeBase.ts — Knowledge Base con Vertex AI Search (RAG)
 * Reemplaza el knowledgeBase.ts del Módulo 1 (keyword matching básico)
 *
 * Para activar: copiar este archivo sobre orchestrator/src/knowledgeBase.ts
 * y agregar la dependencia: npm install @google-cloud/discoveryengine
 */

import { SearchServiceClient, DocumentServiceClient } from '@google-cloud/discoveryengine';

const PROJECT_ID   = process.env.GCP_PROJECT_ID!;
const LOCATION     = process.env.KB_LOCATION || 'global';
const DATA_STORE_ID = process.env.VERTEX_SEARCH_DATASTORE_ID!;

// Serving config path (Vertex AI Search)
const SERVING_CONFIG = [
  `projects/${PROJECT_ID}`,
  `locations/${LOCATION}`,
  `collections/default_collection`,
  `dataStores/${DATA_STORE_ID}`,
  `servingConfigs/default_serving_config`,
].join('/');

const DOCUMENTS_PARENT = [
  `projects/${PROJECT_ID}`,
  `locations/${LOCATION}`,
  `collections/default_collection`,
  `dataStores/${DATA_STORE_ID}`,
  `branches/default_branch`,
].join('/');

const searchClient   = new SearchServiceClient();
const documentClient = new DocumentServiceClient();

// ── Tipos ──────────────────────────────────────────────────────────────────

export interface KBArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  keywords: string[];
  createdAt: string;
  updatedAt: string;
  usageCount?: number;
}

export interface KBSearchResult {
  found: boolean;
  articles: Array<{ id: string; title: string; content: string; score?: number }>;
  message: string;
}

// ── Knowledge Base Client ──────────────────────────────────────────────────

export class KnowledgeBase {

  /**
   * Buscar en la Knowledge Base usando Vertex AI Search (RAG semántico)
   * Llamado por GeminiAgent en cada turno de conversación
   */
  async search(query: string): Promise<KBSearchResult> {
    if (!DATA_STORE_ID) {
      console.warn('[KB] VERTEX_SEARCH_DATASTORE_ID no configurado, usando fallback vacío');
      return { found: false, articles: [], message: 'Knowledge Base no configurada.' };
    }

    try {
      const [response] = await searchClient.search({
        servingConfig: SERVING_CONFIG,
        query,
        pageSize: 3,
        queryExpansionSpec: { condition: 'AUTO' },
        spellCorrectionSpec: { mode: 'AUTO' },
        // Extraer snippets del contenido para respuestas más precisas
        contentSearchSpec: {
          snippetSpec: { returnSnippet: true, maxSnippetCount: 2 },
          summarySpec: {
            summaryResultCount: 3,
            includeCitations: false,
            ignoreAdversarialQuery: true,
          },
        },
      });

      if (!response.results || response.results.length === 0) {
        return {
          found: false,
          articles: [],
          message: 'No encontré información específica sobre ese tema.',
        };
      }

      const articles = response.results
        .filter(r => r.document)
        .map(r => {
          const doc = r.document!;
          // Los datos del artículo están en structData o jsonData
          const data = (doc.structData?.fields || {}) as Record<string, { stringValue?: string }>;
          const snippet = r.document?.derivedStructData?.fields?.snippets?.listValue?.values?.[0]
            ?.structValue?.fields?.snippet?.stringValue || '';

          return {
            id:      doc.id || '',
            title:   data.title?.stringValue   || 'Sin título',
            content: snippet || data.content?.stringValue || '',
            score:   r.modelScores ? Object.values(r.modelScores)[0]?.values?.[0] ?? 0 : 0,
          };
        });

      // Registrar uso para estadísticas (async, no bloquea)
      this.trackUsage(articles.map(a => a.id)).catch(console.error);

      return {
        found: true,
        articles,
        message: `Encontré ${articles.length} resultado(s) relevante(s).`,
      };

    } catch (error) {
      console.error('[KB] Error en búsqueda Vertex AI Search:', error);
      return {
        found: false,
        articles: [],
        message: 'No pude consultar la base de conocimientos en este momento.',
      };
    }
  }

  /**
   * Indexar un nuevo artículo en Vertex AI Search
   * Llamado por el Admin UI cuando se crea/actualiza un artículo
   */
  async indexDocument(article: KBArticle): Promise<void> {
    await documentClient.updateDocument({
      document: {
        id: article.id,
        name: `${DOCUMENTS_PARENT}/documents/${article.id}`,
        structData: {
          fields: {
            title:    { stringValue: article.title },
            content:  { stringValue: article.content },
            category: { stringValue: article.category },
            keywords: { stringValue: article.keywords.join(', ') },
            updatedAt:{ stringValue: article.updatedAt },
          },
        },
      },
      allowMissing: true, // Crea si no existe, actualiza si existe
    });
    console.log(`[KB] Documento indexado: ${article.id}`);
  }

  /**
   * Eliminar un documento del índice de Vertex AI Search
   */
  async deleteDocument(articleId: string): Promise<void> {
    await documentClient.deleteDocument({
      name: `${DOCUMENTS_PARENT}/documents/${articleId}`,
    });
    console.log(`[KB] Documento eliminado: ${articleId}`);
  }

  /**
   * Registrar qué artículos se usaron para estadísticas en Firestore
   */
  private async trackUsage(articleIds: string[]): Promise<void> {
    if (articleIds.length === 0) return;
    const { Firestore } = await import('@google-cloud/firestore');
    const db = new Firestore({ projectId: PROJECT_ID });
    const batch = db.batch();
    const now = new Date().toISOString();

    for (const id of articleIds) {
      const ref = db.collection('knowledge_base').doc(id);
      batch.update(ref, {
        usageCount: Firestore.FieldValue.increment(1),
        lastUsedAt: now,
      });
    }

    await batch.commit().catch(() => {
      // Si el doc no existe en Firestore, ignorar — solo Vertex AI lo tiene
    });
  }
}
