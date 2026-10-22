import { ID } from "node-appwrite";
import { TABLES, getTablesDb, ids, isConflict } from "./appwrite";

/**
 * TablesDB schema for Almost.
 *
 * No permission is granted to any role: every read and write goes through a
 * server route that holds the API key. The browser never talks to the database.
 */

type Column =
  | { key: string; type: "varchar"; size: number; required: boolean }
  | { key: string; type: "longtext" | "text"; required: boolean }
  | { key: string; type: "integer" | "float" | "boolean" | "datetime"; required: boolean };

type Index = {
  key: string;
  type: "key" | "unique";
  attributes: string[];
};

type TableSpec = {
  tableId: string;
  name: string;
  columns: Column[];
  indexes: Index[];
};

export const WORDS_TABLE: TableSpec = {
  tableId: TABLES.words,
  name: "Words",
  columns: [
    { key: "word", type: "varchar", size: 64, required: true },
    { key: "deck", type: "varchar", size: 32, required: true },
    // 768 floats as a JSON array (~9 kB). TablesDB has no array column type.
    { key: "embedding", type: "longtext", required: true },
    // Pre-computed nearest neighbours: what VectorsDB would have returned.
    { key: "neighbours", type: "longtext", required: true },
  ],
  indexes: [
    { key: "idx_words_deck", type: "key", attributes: ["deck"] },
    { key: "idx_words_word", type: "unique", attributes: ["word"] },
  ],
};

export const ROUNDS_TABLE: TableSpec = {
  tableId: TABLES.rounds,
  name: "Rounds",
  columns: [
    { key: "gameId", type: "varchar", size: 36, required: true },
    { key: "roundIndex", type: "integer", required: true },
    { key: "deck", type: "varchar", size: 32, required: true },
    { key: "spice", type: "varchar", size: 16, required: true },
    { key: "secret", type: "varchar", size: 64, required: true },
    { key: "decoy", type: "varchar", size: 64, required: true },
    { key: "distance", type: "float", required: true },
    { key: "accused", type: "varchar", size: 64, required: false },
    { key: "outcome", type: "varchar", size: 16, required: false },
    { key: "createdAt", type: "datetime", required: true },
  ],
  indexes: [{ key: "idx_rounds_game", type: "key", attributes: ["gameId"] }],
};

export const SCORES_TABLE: TableSpec = {
  tableId: TABLES.scores,
  name: "Scores",
  columns: [
    { key: "gameId", type: "varchar", size: 36, required: true },
    { key: "player", type: "varchar", size: 64, required: true },
    { key: "points", type: "integer", required: true },
    { key: "caught", type: "integer", required: true },
  ],
  indexes: [
    { key: "idx_scores_game", type: "key", attributes: ["gameId"] },
    { key: "idx_scores_player", type: "unique", attributes: ["gameId", "player"] },
  ],
};

export const ALL_TABLES = [WORDS_TABLE, ROUNDS_TABLE, SCORES_TABLE];

export async function ensureDatabase(): Promise<void> {
  const tables = getTablesDb();
  try {
    await tables.create({ databaseId: ids.database, name: "Almost" });
    console.log(`  created database "${ids.database}"`);
  } catch (error) {
    if (!isConflict(error)) throw error;
    console.log(`  database "${ids.database}" already exists`);
  }
}

export async function ensureTables({ reset = false }: { reset?: boolean } = {}): Promise<void> {
  const tables = getTablesDb();

  if (reset) {
    for (const table of ALL_TABLES) {
      try {
        await tables.deleteTable({ databaseId: ids.database, tableId: table.tableId });
        console.log(`  dropped table "${table.tableId}"`);
      } catch (error) {
        const code = (error as { code?: number }).code;
        if (code !== 404 && !isConflict(error)) throw error;
      }
    }
    // Give the backend a moment to release the table names.
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  for (const spec of ALL_TABLES) {
    try {
      await tables.createTable({
        databaseId: ids.database,
        tableId: spec.tableId,
        name: spec.name,
        columns: spec.columns,
        indexes: spec.indexes,
        permissions: [],
        rowSecurity: false,
      });
      console.log(`  created table "${spec.tableId}"`);
    } catch (error) {
      if (!isConflict(error)) throw error;
      console.log(`  table "${spec.tableId}" already exists`);
    }
  }
}

export async function createGameRows(gameId: string, players: string[]): Promise<void> {
  const tables = getTablesDb();
  await tables.createRows({
    databaseId: ids.database,
    tableId: TABLES.scores,
    rows: players.map((player) => ({
      $id: ID.unique(),
      gameId,
      player,
      points: 0,
      caught: 0,
    })),
  });
}
