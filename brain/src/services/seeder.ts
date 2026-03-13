import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname, basename } from "node:path";
import { v4 as uuidv4 } from "uuid";
import { embed } from "./embedding.js";
import { ensureCollections, upsert } from "./vectordb.js";

const REPO_ROOT = join(dirname(new URL(import.meta.url).pathname), "..", "..", "..");
const CONTENT_DIRS = ["layout", "cv-content", "knowledge-management", "social-media"];
const CHUNK_TARGET_WORDS = 500;

function findMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...findMarkdownFiles(full));
    } else if (entry.endsWith(".md") && entry !== "README.md") {
      files.push(full);
    }
  }
  return files;
}

function chunkText(text: string): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    const currentWords = current.split(/\s+/).filter(Boolean).length;
    const paraWords = para.split(/\s+/).filter(Boolean).length;

    if (currentWords + paraWords > CHUNK_TARGET_WORDS && current.length > 0) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += (current ? "\n\n" : "") + para;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

function deriveDomain(filePath: string): string {
  const rel = relative(REPO_ROOT, filePath);
  const topDir = rel.split("/")[0];
  return topDir ?? "general";
}

async function seed(): Promise<void> {
  console.log("Seeding best practices into Qdrant...");
  console.log(`Repo root: ${REPO_ROOT}`);

  await ensureCollections();

  let totalChunks = 0;

  for (const dir of CONTENT_DIRS) {
    const fullDir = join(REPO_ROOT, dir);
    try {
      statSync(fullDir);
    } catch {
      console.log(`Skipping ${dir} (not found)`);
      continue;
    }

    const files = findMarkdownFiles(fullDir);
    console.log(`Found ${files.length} markdown files in ${dir}/`);

    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      const relPath = relative(REPO_ROOT, file);
      const domain = deriveDomain(file);
      const chunks = chunkText(content);

      console.log(`  ${relPath}: ${chunks.length} chunk(s)`);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const id = uuidv4();
        const vector = await embed(chunk);

        await upsert("best_practices", id, vector, {
          content: chunk,
          file_path: relPath,
          file_name: basename(file, ".md"),
          domain,
          chunk_index: i,
          total_chunks: chunks.length,
          timestamp: new Date().toISOString(),
        });

        totalChunks++;
      }
    }
  }

  console.log(`Seeding complete. ${totalChunks} chunks stored.`);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
