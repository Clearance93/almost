/**
 * Seeds the word deck into Appwrite TablesDB.
 *
 *   npm run seed            # create schema if missing, upsert words
 *   npm run seed -- --reset # drop and recreate the tables first
 *
 * TablesDB has no vector column type, so the meaning graph is precomputed here:
 * every word stores its 768d embedding and its 40 nearest neighbours (with
 * cosine distance). The app then deals rounds without any runtime math.
 */
import { readFileSync } from "node:fs";
import { EmbeddingModel } from "node-appwrite";
import type { WordData } from "../lib/types";
import {
  EMBEDDING_DIMENSION,
  TABLES,
  describeError,
  getEmbeddings,
  getTablesDb,
  ids,
} from "../lib/appwrite";
import { ensureDatabase, ensureTables } from "../lib/schema";
import { loadLocalEnv } from "./_env";

loadLocalEnv();

const BATCH_SIZE = 25;
const ROW_CHUNK = 10;
const NEIGHBOURS = 40;
const MIN_DISTANCE = 0.16;
const MAX_DISTANCE = 0.58;
/**
 * `nomic-embed-text` puts unrelated words around 0.5, so beyond this distance
 * we only trust a neighbour inside the same deck. It keeps `lantern →
 * lighthouse` (0.34) and drops `espresso → volcano` (0.48).
 */
const CROSS_DECK_DISTANCE = 0.42;

type Neighbour = { id: string; word: string; deck: string; distance: number };

function cosineDistance(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return 1 - dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function main() {
  const reset = process.argv.includes("--reset");
  const data = JSON.parse(
    readFileSync("data/words.json", "utf8").replace(/^\uFEFF/, ""),
  ) as WordData;
  const words = data.words.map((w) => ({ ...w, word: w.word.trim().toLowerCase() }));

  const knownDecks = new Set(data.decks.map((d) => d.id));
  const badDeck = words.find((w) => !knownDecks.has(w.deck));
  if (badDeck) throw new Error(`Word "${badDeck.word}" has unknown deck "${badDeck.deck}"`);
  if (new Set(words.map((w) => w.id)).size !== words.length) {
    throw new Error("Duplicate word ids in data/words.json");
  }

  console.log(`Seeding ${words.length} words across ${data.decks.length} decks…`);
  await ensureDatabase();
  await ensureTables({ reset });

  const embeddings = getEmbeddings();
  const vectors: number[][] = [];

  for (let offset = 0; offset < words.length; offset += BATCH_SIZE) {
    const batch = words.slice(offset, offset + BATCH_SIZE);
    const generated = await embeddings.createTextEmbeddings({
      texts: batch.map((w) => w.word),
      model: EmbeddingModel.Nomicembedtext,
    });

    for (let i = 0; i < batch.length; i++) {
      const vector = generated.embeddings[i]?.embedding;
      if (!vector || vector.length !== EMBEDDING_DIMENSION) {
        throw new Error(
          `Embedding for "${batch[i].word}" was ${vector?.length ?? 0}d, expected ${EMBEDDING_DIMENSION}d`,
        );
      }
      vectors.push(vector);
    }
    console.log(`  embedded ${Math.min(offset + BATCH_SIZE, words.length)}/${words.length}`);
  }

  console.log("  computing neighbour graph…");
  const rows = words.map((word, index) => {
    const neighbours: Neighbour[] = [];
    for (let other = 0; other < words.length; other++) {
      if (other === index) continue;
      const distance = cosineDistance(vectors[index], vectors[other]);
      if (distance <= MIN_DISTANCE || distance > MAX_DISTANCE) continue;
      if (distance > CROSS_DECK_DISTANCE && words[other].deck !== word.deck) continue;
      neighbours.push({
        id: words[other].id,
        word: words[other].word,
        deck: words[other].deck,
        distance: Number(distance.toFixed(4)),
      });
    }
    neighbours.sort((a, b) => a.distance - b.distance);

    return {
      $id: word.id,
      word: word.word,
      deck: word.deck,
      embedding: JSON.stringify(vectors[index].map((v) => Number(v.toFixed(6)))),
      neighbours: JSON.stringify(neighbours.slice(0, NEIGHBOURS)),
    };
  });

  const tables = getTablesDb();
  for (let offset = 0; offset < rows.length; offset += ROW_CHUNK) {
    const chunk = rows.slice(offset, offset + ROW_CHUNK);
    let attempt = 0;
    for (;;) {
      try {
        await tables.upsertRows({
          databaseId: ids.database,
          tableId: TABLES.words,
          rows: chunk,
        });
        break;
      } catch (error) {
        attempt++;
        if (attempt >= 5) throw error;
        // Newly created tables can take a moment to accept writes.
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
      }
    }
    console.log(`  wrote ${Math.min(offset + ROW_CHUNK, rows.length)}/${rows.length} rows`);
  }

  const nearest = rows
    .map((row) => JSON.parse(row.neighbours) as Neighbour[])
    .map((list) => list[0]?.distance)
    .filter((d): d is number => typeof d === "number")
    .sort((a, b) => a - b);

  const median = nearest[Math.floor(nearest.length / 2)] ?? 0;
  console.log(
    `\nDone. ${rows.length} words stored, ${NEIGHBOURS} neighbours each. ` +
      `Closest-neighbour distance: median ${median.toFixed(3)}, ` +
      `min ${nearest[0]?.toFixed(3)}, max ${nearest.at(-1)?.toFixed(3)}.`,
  );
  console.log("Next: npm run check-db, then npm run calibrate");
}

main().catch((error) => {
  console.error("\nSeed failed:", describeError(error));
  process.exit(1);
});
