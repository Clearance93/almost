import "server-only";

import { ID, Query } from "node-appwrite";
import {
  SPICE_RANKS,
  assignRoles,
  createRng,
  pickDecoy,
  scoreRound,
  TOO_CLOSE,
  TOO_FAR,
} from "./game";
import { EMBEDDING_MODEL_LABEL, TABLES, getTablesDb, ids, withRetry } from "./appwrite";
import { createGameRows } from "./schema";
import { seal, open } from "./seal";
import type {
  Candidate,
  LeaderboardEntry,
  RevealPayload,
  Role,
  RoundResponse,
  RoundResult,
  Spice,
} from "./types";
import { deckById } from "./deck";

const NEIGHBOUR_MAP_POINTS = 8;

type WordRow = {
  $id: string;
  word: string;
  deck: string;
  neighbours: string;
};

type ScoreRow = {
  $id: string;
  gameId: string;
  player: string;
  points: number;
  caught: number;
};

type RoundRow = {
  $id: string;
  accused?: string | null;
  outcome?: string | null;
};

function parseNeighbours(raw: string): Candidate[] {
  const parsed = JSON.parse(raw) as { id: string; word: string; deck: string; distance: number }[];
  return parsed.map((n) => ({ id: n.id, word: n.word, deck: n.deck, distance: n.distance }));
}

async function pickSecret(deckId: string, rng: () => number): Promise<WordRow> {
  const tables = getTablesDb();
  const filter = deckId === "any" ? [] : [Query.equal("deck", deckId)];

  const count = await withRetry(() =>
    tables.listRows({
      databaseId: ids.database,
      tableId: TABLES.words,
      queries: [...filter, Query.limit(1)],
    }),
  );

  if (count.total === 0) {
    throw new Error(
      `No words for deck "${deckId}". Run \`npm run seed\` and check APPWRITE_DATABASE_ID.`,
    );
  }

  const offset = Math.floor(rng() * count.total);
  const page = await withRetry(() =>
    tables.listRows({
      databaseId: ids.database,
      tableId: TABLES.words,
      queries: [...filter, Query.offset(offset), Query.limit(1)],
    }),
  );

  const row = page.rows[0] as unknown as WordRow | undefined;
  if (!row) throw new Error("Could not read a secret word from TablesDB");
  return row;
}

export async function buildRound(input: {
  deck: string;
  spice: Spice;
  names: string[];
  gameId?: string;
  roundIndex: number;
  seed?: number;
}): Promise<RoundResponse> {
  if (input.deck !== "any" && !deckById(input.deck)) {
    throw new Error(`Unknown deck "${input.deck}"`);
  }
  if (!Number.isInteger(input.roundIndex) || input.roundIndex < 0 || input.roundIndex > 2) {
    throw new Error("roundIndex must be 0, 1, or 2");
  }

  const tables = getTablesDb();
  const seed = input.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rng = createRng(seed);

  let gameId = input.gameId;
  let secretRow: WordRow;

  if (!gameId) {
    gameId = crypto.randomUUID();
    // Deal the first round's write and the word lookup at the same time.
    const [, row] = await Promise.all([
      createGameRows(gameId, input.names),
      pickSecret(input.deck, rng),
    ]);
    secretRow = row;
  } else {
    secretRow = await pickSecret(input.deck, rng);
  }
  const candidates = parseNeighbours(secretRow.neighbours);
  const decoy = pickDecoy(candidates, input.spice, rng, secretRow.$id);
  if (!decoy) throw new Error("No usable neighbour for that word — widen the deck.");

  const players = input.names.map((name) => ({ id: crypto.randomUUID(), name }));
  const roles = assignRoles(players.length, rng);
  const cards = players.map((player, index) => ({
    playerId: player.id,
    name: player.name,
    word: roles[index] === "odd" ? decoy.word : secretRow.word,
  }));

  const roundId = crypto.randomUUID();
  const distance = decoy.distance;

  await withRetry(() =>
    tables.upsertRow({
      databaseId: ids.database,
      tableId: TABLES.rounds,
      rowId: roundId,
      data: {
        gameId,
        roundIndex: input.roundIndex,
        deck: input.deck,
        spice: input.spice,
        secret: secretRow.word,
        decoy: decoy.word,
        distance,
        createdAt: new Date().toISOString(),
      },
    }),
  );

  const reveal: RevealPayload = {
    roundId,
    gameId,
    seed,
    spice: input.spice,
    deck: input.deck,
    secret: secretRow.word,
    decoy: decoy.word,
    distance,
    decoyRank: decoy.rank ?? 1,
    players: players.map((player, index) => ({
      id: player.id,
      name: player.name,
      role: roles[index],
      word: roles[index] === "odd" ? decoy.word : secretRow.word,
    })),
    neighbours: candidates
      .filter((c) => c.distance > TOO_CLOSE && c.distance < TOO_FAR)
      .slice(0, NEIGHBOUR_MAP_POINTS)
      .map((c) => ({ word: c.word, distance: c.distance })),
    engine: {
      model: EMBEDDING_MODEL_LABEL,
      candidates: candidates.length,
      pool: candidates.filter((c) => c.distance > TOO_CLOSE && c.distance < TOO_FAR).length,
      ranks: SPICE_RANKS[input.spice],
      store: "TablesDB · precomputed neighbour graph",
    },
  };

  return {
    roundId,
    gameId,
    deck: input.deck,
    spice: input.spice,
    seed,
    players,
    cards,
    sealed: seal(reveal),
  };
}

export async function listScores(gameId: string): Promise<LeaderboardEntry[]> {
  const rows = await withRetry(() =>
    getTablesDb().listRows({
      databaseId: ids.database,
      tableId: TABLES.scores,
      queries: [
        Query.equal("gameId", gameId),
        Query.orderDesc("points"),
        Query.orderAsc("caught"),
        Query.limit(20),
      ],
    }),
  );

  return (rows.rows as unknown as ScoreRow[]).map((row) => ({
    player: row.player,
    points: row.points,
    caught: row.caught,
  }));
}

/**
 * Scores a finished round in one transaction: the round row and every player's
 * counter either all land or none do. Atomic increments mean two devices can
 * never lose a point to a race.
 *
 * Retry-safe: if the commit worked but the response was lost, calling again
 * with the same accusation returns the same result instead of scoring twice.
 */
export async function finishRound(input: {
  sealed: string;
  accusedPlayerId: string;
}): Promise<{ reveal: RevealPayload; result: RoundResult; leaderboard: LeaderboardEntry[] }> {
  const tables = getTablesDb();
  const reveal = open<RevealPayload>(input.sealed);

  const accused = reveal.players.find((p) => p.id === input.accusedPlayerId);
  if (!accused) throw new Error("That player is not part of this round");

  const existing = (await withRetry(() =>
    tables.getRow({
      databaseId: ids.database,
      tableId: TABLES.rounds,
      rowId: reveal.roundId,
    }),
  )) as unknown as RoundRow;

  const result = scoreRound(reveal.players, {
    eliminatedId: input.accusedPlayerId,
    tie: false,
  });

  if (existing.outcome) {
    if (existing.accused === accused.name) {
      return { reveal, result, leaderboard: await listScores(reveal.gameId) };
    }
    throw new Error("This round has already been scored by a different vote");
  }

  const scoreRows = await withRetry(() =>
    tables.listRows({
      databaseId: ids.database,
      tableId: TABLES.scores,
      queries: [Query.equal("gameId", reveal.gameId), Query.limit(20)],
    }),
  );
  const scoreRowByName = new Map(
    (scoreRows.rows as unknown as ScoreRow[]).map((row) => [row.player, row.$id]),
  );

  const transaction = await withRetry(() => tables.createTransaction());

  const operations: Record<string, unknown>[] = [
    {
      action: "update",
      databaseId: ids.database,
      tableId: TABLES.rounds,
      rowId: reveal.roundId,
      data: { accused: accused.name, outcome: result.winners },
    },
  ];

  for (const player of reveal.players) {
    const rowId = scoreRowByName.get(player.name);
    if (!rowId) continue;

    const points = result.points[player.id] ?? 0;
    if (points > 0) {
      operations.push({
        action: "increment",
        databaseId: ids.database,
        tableId: TABLES.scores,
        rowId,
        data: { column: "points", value: points },
      });
    }

    if (result.caughtIds.includes(player.id)) {
      operations.push({
        action: "increment",
        databaseId: ids.database,
        tableId: TABLES.scores,
        rowId,
        data: { column: "caught", value: 1 },
      });
    }
  }

  try {
    await tables.createOperations({
      transactionId: transaction.$id,
      operations: operations as never,
    });
    await tables.updateTransaction({ transactionId: transaction.$id, commit: true });
  } catch (error) {
    await tables
      .updateTransaction({ transactionId: transaction.$id, rollback: true })
      .catch(() => undefined);
    throw error;
  }

  const leaderboard = await listScores(reveal.gameId);
  return { reveal, result, leaderboard };
}
