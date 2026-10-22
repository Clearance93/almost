/**
 * Verifies the VectorsDB setup and prints a live similarity search.
 *
 *   npm run check-db
 */
import { EmbeddingModel, Query } from "node-appwrite";
import { describeError, getEmbeddings, getVectorsDb, ids } from "../lib/appwrite";
import { loadLocalEnv } from "./_env";

loadLocalEnv();

type DistanceDocument = { $id: string; $distance?: number; metadata?: { word?: string } };

async function main() {
  const vdb = getVectorsDb();
  const embeddings = getEmbeddings();

  const collection = await vdb.getCollection({
    databaseId: ids.database,
    collectionId: ids.collection,
  });
  console.log(`Collection  ${collection.name} · dimension ${collection.dimension}`);

  const count = await vdb.listDocuments({
    databaseId: ids.database,
    collectionId: ids.collection,
    queries: [Query.limit(1)],
  });
  console.log(`Documents   ${count.total}`);

  const generated = await embeddings.createTextEmbeddings({
    texts: ["lantern"],
    model: EmbeddingModel.Nomicembedtext,
  });
  const vector = generated.embeddings[0]?.embedding ?? [];
  console.log(`Embedding   ${vector.length}d · ${vector.slice(0, 3).map((n) => n.toFixed(3)).join(", ")}…`);

  const results = (await vdb.listDocuments({
    databaseId: ids.database,
    collectionId: ids.collection,
    queries: [Query.vectorCosine("embeddings", vector), Query.limit(8)],
  })) as unknown as { documents: DistanceDocument[] };

  console.log("\nNearest words to “lantern”:");
  for (const doc of results.documents) {
    const distance = doc.$distance ?? Number.NaN;
    console.log(`  ${(doc.metadata?.word ?? doc.$id).padEnd(14)} ${distance.toFixed(4)}`);
  }

  console.log("\nOK — VectorsDB is reachable and ranking by cosine distance.");
}

main().catch((error) => {
  console.error("check-db failed:", describeError(error));
  process.exit(1);
});
