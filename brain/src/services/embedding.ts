import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

// Multilingual model — DE↔EN concept recognition (~0.88 cross-language similarity)
// See: docs/missions/mission-multilingual-brain.md
const MODEL_ID = "Xenova/multilingual-e5-small";

let extractor: FeatureExtractionPipeline | null = null;

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractor) {
    console.log(`Loading embedding model (${MODEL_ID})...`);
    extractor = await pipeline("feature-extraction", MODEL_ID);
    console.log("Embedding model loaded.");
  }
  return extractor;
}

export async function embed(text: string): Promise<number[]> {
  const ext = await getExtractor();
  const output = await ext(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

export const EMBEDDING_DIM = 384;
