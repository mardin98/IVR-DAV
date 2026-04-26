// aggregator/src/index.ts — Entry point HTTP (Cloud Run + Cloud Scheduler)
import 'dotenv/config';
import express from 'express';
import { aggregateDay } from './dailyAggregator';
import { updateRealtimeMetrics } from './realtimeMetrics';

const app  = express();
const PORT = process.env.PORT || 8082;
app.use(express.json());

app.get('/health', (_, res) => res.json({ ok: true, service: 'metrics-aggregator' }));

// Trigger diario: Cloud Scheduler lo llama a las 00:05
app.post('/aggregate/daily', async (req, res) => {
  try {
    // Permitir fecha custom para re-procesar días anteriores
    const targetDate = req.body?.date ? new Date(req.body.date) : undefined;
    const metrics = await aggregateDay(targetDate);
    res.json({ ok: true, date: metrics.date, totalCalls: metrics.totalCalls });
  } catch (e) {
    console.error('[Aggregator] daily error:', e);
    res.status(500).json({ error: String(e) });
  }
});

// Trigger cada 5 min: métricas en tiempo real
app.post('/aggregate/realtime', async (_, res) => {
  try {
    const metrics = await updateRealtimeMetrics();
    res.json({ ok: true, callsToday: metrics.callsToday, updatedAt: metrics.updatedAt });
  } catch (e) {
    console.error('[Aggregator] realtime error:', e);
    res.status(500).json({ error: String(e) });
  }
});

// Re-procesar rango de fechas (útil para migración o correcciones)
app.post('/aggregate/range', async (req, res) => {
  const { from, to } = req.body as { from: string; to: string };
  if (!from || !to) return res.status(400).json({ error: 'from y to requeridos (YYYY-MM-DD)' });

  const results = [];
  const current = new Date(from);
  const end     = new Date(to);

  while (current <= end) {
    const metrics = await aggregateDay(new Date(current));
    results.push({ date: metrics.date, totalCalls: metrics.totalCalls });
    current.setDate(current.getDate() + 1);
  }

  res.json({ ok: true, processed: results.length, results });
});

app.listen(PORT, () => {
  console.log(`[Aggregator] Corriendo en puerto ${PORT}`);
});
