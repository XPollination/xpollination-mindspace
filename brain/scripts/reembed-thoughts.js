#!/usr/bin/env node
/**
 * Re-embed all thoughts in Qdrant best_practices collection with the new model.
 *
 * Use after switching the embedding model in src/services/embedding.ts.
 * Reads each point, re-embeds the content with the new model, upserts back with same ID.
 *
 * Usage (inside brain container, after restart with new model):
 *   node scripts/reembed-thoughts.js
 */

import { pipeline } from '@huggingface/transformers';

const QDRANT_URL = process.env.QDRANT_URL || 'http://qdrant:6333';
const COLLECTION = 'best_practices';
const MODEL_ID = 'Xenova/multilingual-e5-small';

async function main() {
  console.log(`Loading model ${MODEL_ID}...`);
  const extractor = await pipeline('feature-extraction', MODEL_ID);
  console.log('Model loaded.');

  // Scroll through all points
  let offset = null;
  let total = 0;
  let updated = 0;
  let skipped = 0;
  const batchSize = 100;

  while (true) {
    const scrollBody = {
      limit: batchSize,
      with_payload: true,
      with_vector: false,
    };
    if (offset) scrollBody.offset = offset;

    const scrollRes = await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points/scroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scrollBody),
    });

    if (!scrollRes.ok) {
      console.error('Scroll failed:', await scrollRes.text());
      process.exit(1);
    }

    const scrollData = await scrollRes.json();
    const points = scrollData.result?.points || [];
    if (points.length === 0) break;

    total += points.length;
    console.log(`Processing batch of ${points.length} (total seen: ${total})...`);

    // Re-embed each point and upsert
    const upsertPoints = [];
    for (const point of points) {
      const content = point.payload?.content;
      if (!content || typeof content !== 'string') {
        skipped++;
        continue;
      }

      const output = await extractor(content, { pooling: 'mean', normalize: true });
      const vector = Array.from(output.data);

      upsertPoints.push({
        id: point.id,
        vector,
        payload: point.payload,
      });
    }

    if (upsertPoints.length > 0) {
      const upsertRes = await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points?wait=true`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: upsertPoints }),
      });

      if (!upsertRes.ok) {
        console.error('Upsert failed:', await upsertRes.text());
        process.exit(1);
      }
      updated += upsertPoints.length;
    }

    offset = scrollData.result?.next_page_offset;
    if (!offset) break;
  }

  console.log(`\nDone. Total: ${total}, updated: ${updated}, skipped: ${skipped}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
