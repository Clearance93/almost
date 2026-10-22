/**
 * Prints real cosine distances so the spice bands stay calibrated.
 *
 *   npm run calibrate                  # default sample words
 *   npm run calibrate -- coffee        # one word's neighbourhood
 *   npm run calibrate -- lantern lighthouse   # distance between two words
 */
import { EmbeddingModel, Query } from "node-appwrite";
import { SPICE_BANDS } from "../lib/game";
import { describeError, getEmbeddings, getVectorsDb, ids } from "../lib/appwrite";
import { loadLocalEnv } from "./_env";

loadLocalEnv();

const DEFAULT_SAMPLE = ["lantern", "coffee", "otter", "airport", "violin", "nostalgia"];

type DistanceDocument = { $id: string; $distance?: number; metadata?: { word?: string } };

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
  const args = process.argv.slice(2).map((s) => s.trim().toLowerCase()).filter(Boolean);
  const embeddings = getEmbeddings();
  const vdb = getVectorsDb();

  if (args.length === 2) {
    const generated = await embeddings.createTextEmbeddings({
      texts: args,
      model: EmbeddingModel.Nomicembedtext,
    });
    const [a, b] = generated.embeddings.map((e) => e.embedding);
    console.log(`cosine distance  ${args[0]} ↔ ${args[1]}  =  ${cosineDistance(a, b).toFixed(4)}`);
    return;
  }

  const words = args.length > 0 ? args : DEFAULT_SAMPLE;
  console.log(
    `bands: mild ${SPICE_BANDS.mild.min}–${SPICE_BANDS.mild.max} · ` +
      `medium ${SPICE_BANDS.medium.min}–${SPICE_BANDS.medium.max} · ` +
      `hot ${SPICE_BANDS.hot.min}–${SPICE_BANDS.hot.max}\n`,
  );

  const generated = await embeddings.createTextEmbeddings({
    texts: words,
    model: EmbeddingModel.Nomicembedtext,
  });

  for (let i = 0; i < words.length; i++) {
    const results = (await vdb.listDocuments({
      databaseId: ids.database,
      collectionId: ids.collection,
      queries: [Query.vectorCosine("embeddings", generated.embeddings[i].embedding), Query.limit(9)],
    })) as unknown as { documents: DistanceDocument[] };

    console.log(words[i]);
    for (const doc of results.documents) {
      const distance = doc.$distance ?? Number.NaN;
      const mark =
        distance > 0.14 && distance < 0.78 ? (distance >= 0.36 ? "◆" : "·") : " ";
      console.log(`   ${mark} ${(doc.metadata?.word ?? doc.$id).padEnd(16)} ${distance.toFixed(3)}`);
    }
    console.log("");
  }
}

main().catch((error) => {
  console.error("calibrate failed:", describeError(error));
  process.exit(1);
});
