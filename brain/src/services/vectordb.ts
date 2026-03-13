import { QdrantClient } from "@qdrant/js-client-rest";
import { EMBEDDING_DIM } from "./embedding.js";

const client = new QdrantClient({ url: "http://localhost:6333" });

export async function ensureCollections(): Promise<void> {
  const collections = await client.getCollections();
  const names = collections.collections.map((c) => c.name);

  if (!names.includes("best_practices")) {
    await client.createCollection("best_practices", {
      vectors: { size: EMBEDDING_DIM, distance: "Cosine" },
    });
    console.log("Created collection: best_practices");
  }

  if (!names.includes("queries")) {
    await client.createCollection("queries", {
      vectors: { size: EMBEDDING_DIM, distance: "Cosine" },
    });
    console.log("Created collection: queries");
  }
}

export async function search(
  collection: string,
  vector: number[],
  limit: number = 5,
  filter?: Record<string, unknown>
): Promise<Array<{ id: string; score: number; payload: Record<string, unknown> }>> {
  const results = await client.search(collection, {
    vector,
    limit,
    with_payload: true,
    ...(filter ? { filter } : {}),
  });

  return results.map((r) => ({
    id: String(r.id),
    score: r.score,
    payload: (r.payload ?? {}) as Record<string, unknown>,
  }));
}

export async function upsert(
  collection: string,
  id: string,
  vector: number[],
  payload: Record<string, unknown>
): Promise<void> {
  await client.upsert(collection, {
    wait: true,
    points: [{ id, vector, payload }],
  });
}

export async function getCollectionInfo(name: string): Promise<{ points_count: number } | null> {
  try {
    const info = await client.getCollection(name);
    return { points_count: info.points_count ?? 0 };
  } catch {
    return null;
  }
}

export async function isHealthy(): Promise<boolean> {
  try {
    await client.getCollections();
    return true;
  } catch {
    return false;
  }
}
