import "server-only";

import { EmbeddingModel, Query } from "node-appwrite";
import {
  SPICE_BANDS,
  assignRoles,
  createRng,
  pickDecoy,
  TOO_CLOSE,
  TOO_FAR,
} from "./game";
import { EMBEDDING_MODEL_LABEL, getEmbeddings, getVectorsDb, ids } from "./appwrite";
import { seal } from "./seal";
import type { Candidate, RevealPayload, RoundResponse, Spice } from "./types";
import { deckById, wordsInDeck } from "./deck";

export type RoundCard = { playerId: string; name: string; word: string };

type WordDocument = {
  $id: string;
  $distance?: number;
  embeddings?: number[];
  metadata?: { word?: string; deck?: string };
};

const NEIGHBOUR_LIMIT = 41;
const MAP_POINTS = 8;

function requireDocWord(doc: WordDocument): string {
  const word = doc.metadata?.word;
  if (!word) throw new Error(`Document ${doc.$id} has no metadata.word`);
  return word;
}

async function pickSecret(deckId: string, rng: () => number) {
  if (deckId !== "any" && !deckById(deckId)) {
    throw new Error(`Unknown deck "${deckId}"`);
  }

  const filter = deckId === "any" ? [] : [Query.equal("metadata.deck", deckId)];
  const count = await getVectorsDb().listDocuments({
    databaseId: ids.database,
    collectionId: ids.collection,
    queries: [...filter, Query.limit(1)],
  });

  if (count.total === 0) {
    throw new Error(
      `No words in deck "${deckId}". Run \`npm run seed\` before starting a round.`,
    );
  }

  const offset = Math.floor(rng() * count.total);
  const page = (await getVectorsDb().listDocuments({
    databaseId: ids.database,
    collectionId: ids.collection,
    queries: [...filter, Query.offset(offset), Query.limit(1)],
  })) as unknown as { documents: WordDocument[] };

  const doc = page.documents[0];
  if (!doc) throw new Error("Could not read a secret word from VectorsDB");
  return doc;
}

async function secretVector(doc: WordDocument): Promise<number[]> {
  if (doc.embeddings && doc.embeddings.length > 0) return doc.embeddings;

  const generated = await getEmbeddings().createTextEmbeddings({
    texts: [requireDocWord(doc)],
    model: EmbeddingModel.Nomicembedtext,
  });
  const vector = generated.embeddings[0]?.embedding;
  if (!vector) throw new Error("Appwrite Embeddings returned an empty vector");
  return vector;
}

async function neighbours(vector: number[], secretId: string): Promise<Candidate[]> {
  const result = (await getVectorsDb().listDocuments({
    databaseId: ids.database,
    collectionId: ids.collection,
    queries: [Query.vectorCosine("embeddings", vector), Query.limit(NEIGHBOUR_LIMIT)],
  })) as unknown as { documents: WordDocument[] };

  return result.documents
    .filter((doc) => doc.$id !== secretId && typeof doc.$distance === "number")
    .map((doc) => ({
      id: doc.$id,
      word: requireDocWord(doc),
      distance: doc.$distance as number,
      deck: doc.metadata?.deck,
    }));
}

export async function buildRound(input: {
  deck: string;
  spice: Spice;
  names: string[];
  seed?: number;
}): Promise<RoundResponse> {
  const seed = input.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rng = createRng(seed);
  const deckId = input.deck === "any" ? "any" : input.deck;

  if (wordsInDeck(deckId).length === 0) {
    throw new Error(`Deck "${deckId}" is empty`);
  }

  const secretDoc = await pickSecret(deckId, rng);
  const secretWord = requireDocWord(secretDoc);
  const vector = await secretVector(secretDoc);
  const candidates = await neighbours(vector, secretDoc.$id);
  const decoy = pickDecoy(candidates, input.spice, rng, secretDoc.$id);

  if (!decoy) {
    throw new Error(
      "No usable neighbour found. Widen the word deck or re-run the calibration script.",
    );
  }

  const players = input.names.map((name) => ({ id: crypto.randomUUID(), name }));
  const roles = assignRoles(players.length, rng);
  const cards: RoundCard[] = players.map((player, index) => ({
    playerId: player.id,
    name: player.name,
    word: roles[index] === "odd" ? decoy.word : secretWord,
  }));

  const distance = candidates.find((c) => c.id === decoy.id)?.distance ?? decoy.distance;
  const roundId = crypto.randomUUID();

  const reveal: RevealPayload = {
    roundId,
    seed,
    spice: input.spice,
    deck: deckId,
    secret: secretWord,
    decoy: decoy.word,
    distance,
    players: players.map((player, index) => ({
      id: player.id,
      name: player.name,
      role: roles[index],
      word: roles[index] === "odd" ? decoy.word : secretWord,
    })),
    neighbours: candidates
      .filter((c) => c.distance > TOO_CLOSE && c.distance < TOO_FAR)
      .slice(0, MAP_POINTS)
      .map((c) => ({ word: c.word, distance: c.distance })),
    engine: {
      model: EMBEDDING_MODEL_LABEL,
      candidates: candidates.length,
      pool: candidates.filter((c) => c.distance > TOO_CLOSE && c.distance < TOO_FAR).length,
      band: SPICE_BANDS[input.spice],
    },
  };

  return {
    roundId,
    deck: deckId,
    spice: input.spice,
    seed,
    players,
    cards,
    sealed: seal(reveal),
  };
}
