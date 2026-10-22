/**
 * Verifies the TablesDB setup and prints a stored neighbour graph.
 *
 *   npm run check-db
 */
import { Query } from "node-appwrite";
import { TABLES, describeError, getTablesDb, ids } from "../lib/appwrite";
import { loadLocalEnv } from "./_env";

loadLocalEnv();

type Neighbour = { id: string; word: string; deck: string; distance: number };

async function main() {
  const tables = getTablesDb();

  for (const tableId of [TABLES.words, TABLES.rounds, TABLES.scores]) {
    const list = await tables.listRows({
      databaseId: ids.database,
      tableId,
      queries: [Query.limit(1)],
    });
    console.log(`${tableId.padEnd(8)} ${list.total} rows`);
  }

  const row = (await tables.getRow({
    databaseId: ids.database,
    tableId: TABLES.words,
    rowId: "lantern",
  })) as unknown as {
    word: string;
    deck: string;
    embedding: string;
    neighbours: string;
  };

  const embedding = JSON.parse(row.embedding) as number[];
  const neighbours = JSON.parse(row.neighbours) as Neighbour[];

  console.log(`\n"${row.word}" (${row.deck}) · ${embedding.length}d embedding`);
  console.log("Stored neighbours:");
  for (const n of neighbours.slice(0, 8)) {
    console.log(`  ${n.word.padEnd(14)} ${n.distance.toFixed(4)}  [${n.deck}]`);
  }

  console.log("\nOK — TablesDB is reachable and the neighbour graph is seeded.");
}

main().catch((error) => {
  console.error("check-db failed:", describeError(error));
  process.exit(1);
});
