/**
 * Inspects the stored neighbour graph and checks the spice bands still make sense.
 *
 *   npm run calibrate
 *   npm run calibrate -- coffee
 *   npm run calibrate -- lantern lighthouse
 */
import { Query } from "node-appwrite";
import { SPICE_BANDS, TOO_CLOSE, TOO_FAR } from "../lib/game";
import { TABLES, describeError, getTablesDb, ids } from "../lib/appwrite";
import { loadLocalEnv } from "./_env";

loadLocalEnv();

const DEFAULT_SAMPLE = ["lantern", "coffee", "otter", "airport", "violin", "nostalgia"];

type Neighbour = { id: string; word: string; deck: string; distance: number };
type WordRow = { $id: string; word: string; deck: string; embedding: string; neighbours: string };

async function getWord(rowId: string): Promise<WordRow> {
  const row = (await getTablesDb().getRow({
    databaseId: ids.database,
    tableId: TABLES.words,
    rowId,
  })) as unknown as WordRow;
  return row;
}

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

  if (args.length === 2) {
    const [a, b] = await Promise.all([getWord(args[0]), getWord(args[1])]);
    const distance = cosineDistance(JSON.parse(a.embedding), JSON.parse(b.embedding));
    console.log(`${a.word} ↔ ${b.word}  cosine distance ${distance.toFixed(4)}`);
    return;
  }

  const words = args.length > 0 ? args : DEFAULT_SAMPLE;
  console.log(
    `bands: mild ${SPICE_BANDS.mild.min}–${SPICE_BANDS.mild.max} · ` +
      `medium ${SPICE_BANDS.medium.min}–${SPICE_BANDS.medium.max} · ` +
      `hot ${SPICE_BANDS.hot.min}–${SPICE_BANDS.hot.max}\n`,
  );

  for (const word of words) {
    const row = await getWord(word);
    const neighbours = (JSON.parse(row.neighbours) as Neighbour[]).slice(0, 9);
    console.log(`${row.word}  [${row.deck}]`);
    for (const n of neighbours) {
      const usable = n.distance > TOO_CLOSE && n.distance < TOO_FAR;
      const mark = usable ? (n.distance >= SPICE_BANDS.medium.min ? "◆" : "·") : " ";
      console.log(`   ${mark} ${n.word.padEnd(16)} ${n.distance.toFixed(3)}`);
    }
    console.log("");
  }

  // Coverage: how many words have a healthy pool for each spice level?
  const all: WordRow[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await getTablesDb().listRows({
      databaseId: ids.database,
      tableId: TABLES.words,
      queries: [Query.limit(100), Query.offset(offset)],
    });
    all.push(...(page.rows as unknown as WordRow[]));
    if (page.rows.length < 100) break;
  }

  console.log(`Coverage across ${all.length} words (at least 3 decoys available):`);
  for (const spice of ["mild", "medium", "hot"] as const) {
    const band = SPICE_BANDS[spice];
    const count = all.filter((row) => {
      const pool = (JSON.parse(row.neighbours) as Neighbour[]).filter(
        (n) => n.distance >= band.min && n.distance <= band.max,
      );
      return pool.length >= 3;
    }).length;
    console.log(`  ${spice.padEnd(7)} ${count}/${all.length} (${Math.round((count / all.length) * 100)}%)`);
  }
}

main().catch((error) => {
  console.error("calibrate failed:", describeError(error));
  process.exit(1);
});
