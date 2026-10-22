/**
 * Inspects the stored neighbour graph and checks the spice windows still make sense.
 *
 *   npm run calibrate
 *   npm run calibrate -- coffee
 *   npm run calibrate -- lantern lighthouse
 */
import { Query } from "node-appwrite";
import { SPICE_RANKS, TOO_CLOSE, TOO_FAR } from "../lib/game";
import { TABLES, describeError, getTablesDb, ids } from "../lib/appwrite";
import { loadLocalEnv } from "./_env";

loadLocalEnv();

const DEFAULT_SAMPLE = ["lantern", "espresso", "otter", "airport", "violin", "nostalgia"];

type Neighbour = { id: string; word: string; deck: string; distance: number };
type WordRow = { $id: string; word: string; deck: string; embedding: string; neighbours: string };

async function getWord(rowId: string): Promise<WordRow> {
  return (await getTablesDb().getRow({
    databaseId: ids.database,
    tableId: TABLES.words,
    rowId,
  })) as unknown as WordRow;
}

function usable(list: Neighbour[]): Neighbour[] {
  return list.filter((n) => n.distance > TOO_CLOSE && n.distance < TOO_FAR);
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
    `draws: mild #1–#${SPICE_RANKS.mild.to} · medium #${SPICE_RANKS.medium.from + 1}–#${SPICE_RANKS.medium.to} · ` +
      `hot #${SPICE_RANKS.hot.from + 1}–#${SPICE_RANKS.hot.to} · max distance ${TOO_FAR}\n`,
  );

  for (const word of words) {
    const row = await getWord(word);
    const list = usable(JSON.parse(row.neighbours) as Neighbour[]).slice(0, 9);
    console.log(`${row.word}  [${row.deck}]  ${list.length} usable neighbours`);
    list.forEach((n, index) => {
      const mark = index < 2 ? "1" : index < 5 ? "2" : "3";
      console.log(
        `   ${mark} ${String(index + 1).padStart(2)}. ${n.word.padEnd(16)} ${n.distance.toFixed(3)}  [${n.deck}]`,
      );
    });
    if (list.length < SPICE_RANKS.hot.to) {
      console.log("   ! thin graph for this word — hot will fall back to the closest");
    }
    console.log("");
  }

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

  console.log(`Coverage across ${all.length} words (window can be filled):`);
  for (const spice of ["mild", "medium", "hot"] as const) {
    const need = SPICE_RANKS[spice].to;
    const count = all.filter((row) => usable(JSON.parse(row.neighbours)).length >= need).length;
    console.log(
      `  ${spice.padEnd(7)} ${count}/${all.length} (${Math.round((count / all.length) * 100)}%)`,
    );
  }
}

main().catch((error) => {
  console.error("calibrate failed:", describeError(error));
  process.exit(1);
});
