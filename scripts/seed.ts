/**
 * Seeds the word deck into Appwrite VectorsDB.
 *
 *   npm run seed
 *
 * Idempotent: documents are upserted by word id, and existing database /
 * collection / index are reused. Safe to re-run after editing data/words.json.
 */
import { readFileSync } from "node:fs";
import { EmbeddingModel, Permission, Query, Role, VectorsDBIndexType } from "node-appwrite";
import type { WordData } from "../lib/types";
import {
  describeError,
  EMBEDDING_DIMENSION,
  getEmbeddings,
  getVectorsDb,
  ids,
  isConflict,
} from "../lib/appwrite";
import { loadLocalEnv } from "./_env";

loadLocalEnv();

const BATCH_SIZE = 25;

async function main() {
  const data = JSON.parse(readFileSync("data/words.json", "utf8")) as WordData;
  const words = data.words.map((w) => ({ ...w, word: w.word.trim().toLowerCase() }));

  const knownDecks = new Set(data.decks.map((d) => d.id));
  const badDeck = words.find((w) => !knownDecks.has(w.deck));
  if (badDeck) throw new Error(`Word "${badDeck.word}" has unknown deck "${badDeck.deck}"`);

  const duplicate = words.find(
    (w, i) => words.findIndex((o) => o.id === w.id) !== i,
  );
  if (duplicate) throw new Error(`Duplicate word id "${duplicate.id}" in data/words.json`);

  const vdb = getVectorsDb();
  const embeddings = getEmbeddings();

  console.log(`Seeding ${words.length} words across ${data.decks.length} decks…`);

  try {
    await vdb.create({ databaseId: ids.database, name: "Almost" });
    console.log(`  created database ${ids.database}`);
  } catch (error) {
    if (!isConflict(error)) throw error;
    console.log(`  database ${ids.database} already exists`);
  }

  try {
    await vdb.createCollection({
      databaseId: ids.database,
      collectionId: ids.collection,
      name: "Words",
      dimension: EMBEDDING_DIMENSION,
      permissions: [Permission.read(Role.any())],
      documentSecurity: false,
      enabled: true,
    });
    console.log(`  created collection ${ids.collection} (${EMBEDDING_DIMENSION}d)`);
  } catch (error) {
    if (!isConflict(error)) throw error;
    console.log(`  collection ${ids.collection} already exists`);
  }

  try {
    await vdb.createIndex({
      databaseId: ids.database,
      collectionId: ids.collection,
      key: "embeddings_index",
      type: VectorsDBIndexType.HnswCosine,
      attributes: ["embeddings"],
    });
    console.log("  created HNSW cosine index");
  } catch (error) {
    if (!isConflict(error)) throw error;
    console.log("  index already exists");
  }

  let written = 0;
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
          `Embedding for "${batch[i].word}" was ${
            vector?.length ?? 0
          }d, expected ${EMBEDDING_DIMENSION}d.`,
        );
      }

      await vdb.upsertDocument({
        databaseId: ids.database,
        collectionId: ids.collection,
        documentId: batch[i].id,
        data: {
          embeddings: vector,
          metadata: { word: batch[i].word, deck: batch[i].deck },
        },
        permissions: [Permission.read(Role.any())],
      });
      written++;
    }

    console.log(`  embedded ${written}/${words.length}`);
  }

  const total = await vdb.listDocuments({
    databaseId: ids.database,
    collectionId: ids.collection,
    queries: [Query.limit(1)],
  });

  console.log(`\nDone. Collection holds ${total.total} words.`);
  console.log("Next: npm run check-db && npm run calibrate");
}

main().catch((error) => {
  console.error("\nSeed failed:", describeError(error));
  process.exit(1);
});
