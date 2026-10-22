/**
 * Domain types shared by the UI, the round engine, and the data layer.
 * Keep this file free of Appwrite imports so it can run in the browser.
 */

export type Spice = "mild" | "medium" | "hot";
export type Role = "civilian" | "odd";
export type DeckId = string;

export type Deck = {
  id: DeckId;
  name: string;
  blurb: string;
};

export type WordEntry = {
  id: string;
  word: string;
  deck: DeckId;
};

export type WordData = {
  version: number;
  decks: Deck[];
  words: WordEntry[];
};

/** A word returned by vector search, with its cosine distance from the query word. */
export type Candidate = {
  id: string;
  word: string;
  distance: number;
  deck?: DeckId;
};

/** The two words a round is built from. */
export type Pair = {
  secret: Candidate;
  decoy: Candidate;
};

export type Player = {
  id: string;
  name: string;
  role: Role;
  word: string;
};

export type Vote = {
  voterId: string;
  suspectId: string;
};

export type RoundTally = {
  eliminatedId: string | null;
  tie: boolean;
};

export type RoundResult = RoundTally & {
  winners: "civilians" | "odd" | "none";
  caughtIds: string[];
  points: Record<string, number>;
};

/** Shape returned by POST /api/reveal (decrypted from the sealed round token). */
export type RevealPayload = {
  roundId: string;
  gameId: string;
  seed: number;
  spice: Spice;
  deck: string;
  secret: string;
  decoy: string;
  distance: number;
  players: { id: string; name: string; role: Role; word: string }[];
  neighbours: { word: string; distance: number }[];
  engine: {
    model: string;
    candidates: number;
    pool: number;
    band: { min: number; max: number };
    store: string;
  };
};

export type LeaderboardEntry = {
  player: string;
  points: number;
  caught: number;
};

export type RoundResponse = {
  roundId: string;
  gameId: string;
  deck: string;
  spice: Spice;
  seed: number;
  players: { id: string; name: string }[];
  cards: { playerId: string; name: string; word: string }[];
  sealed: string;
};
