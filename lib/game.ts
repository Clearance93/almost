import type {
  Candidate,
  Player,
  Role,
  RoundResult,
  RoundTally,
  Spice,
  Vote,
} from "./types";

/**
 * Cosine *distance* bands (0 = identical meaning, 2 = opposite).
 *
 * Calibrated against Appwrite's `nomic-embed-text` embeddings: a pair inside
 * these bands shares a context but is still worth describing out loud.
 * `npm run calibrate` prints real distances so these numbers stay honest.
 */
export const SPICE_BANDS: Record<Spice, { min: number; max: number }> = {
  mild: { min: 0.26, max: 0.42 },
  medium: { min: 0.36, max: 0.55 },
  hot: { min: 0.48, max: 0.68 },
};

/** Below this the two words are effectively synonyms and the round is unfair. */
export const TOO_CLOSE = 0.14;

/** Above this the decoy is obviously unrelated and the round is trivial. */
export const TOO_FAR = 0.78;

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 10;

export function oddCountFor(playerCount: number): number {
  if (playerCount >= 9) return 3;
  if (playerCount >= 7) return 2;
  return 1;
}

/** Deterministic, seedable PRNG so a round can be replayed and unit tested. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function similarity(distance: number): number {
  return Math.max(0, Math.min(1, 1 - distance));
}

/**
 * Pick the decoy from a vector-search result page.
 *
 * The database does the semantic work: we ask for the closest words to the
 * secret and keep the ones that sit inside the band for the chosen spice.
 * A wider band means a looser neighbour, which is harder to bluff.
 */
export function pickDecoy(
  candidates: readonly Candidate[],
  spice: Spice,
  rng: () => number,
  secretId?: string,
): Candidate | null {
  const band = SPICE_BANDS[spice];
  const usable = candidates.filter(
    (c) =>
      c.id !== secretId &&
      c.distance > TOO_CLOSE &&
      c.distance < TOO_FAR &&
      c.word.trim().length > 1,
  );

  const inBand = usable.filter((c) => c.distance >= band.min && c.distance <= band.max);
  if (inBand.length > 0) {
    return inBand[Math.floor(rng() * inBand.length)];
  }

  // Nothing landed in the band: take the closest usable neighbour rather than fail.
  if (usable.length === 0) return null;
  return [...usable].sort(
    (a, b) => Math.abs(a.distance - band.min) - Math.abs(b.distance - band.min),
  )[0];
}

export function assignRoles(playerCount: number, rng: () => number): Role[] {
  if (playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
    throw new Error(`playerCount must be between ${MIN_PLAYERS} and ${MAX_PLAYERS}`);
  }
  const oddCount = oddCountFor(playerCount);
  const roles: Role[] = Array.from({ length: playerCount }, (_, i) =>
    i < oddCount ? "odd" : "civilian",
  );
  return shuffle(roles, rng);
}

export function dealRound(
  players: { id: string; name: string }[],
  secret: string,
  decoy: string,
  rng: () => number,
): Player[] {
  const roles = assignRoles(players.length, rng);
  return players.map((p, i) => ({
    ...p,
    role: roles[i],
    word: roles[i] === "odd" ? decoy : secret,
  }));
}

/** A tie means nobody leaves the table — and the odd players got away with it. */
export function tallyVotes(votes: readonly Vote[]): RoundTally {
  if (votes.length === 0) return { eliminatedId: null, tie: true };

  const counts = new Map<string, number>();
  for (const vote of votes) {
    counts.set(vote.suspectId, (counts.get(vote.suspectId) ?? 0) + 1);
  }

  let best = 0;
  let leaders: string[] = [];
  for (const [id, count] of counts) {
    if (count > best) {
      best = count;
      leaders = [id];
    } else if (count === best) {
      leaders.push(id);
    }
  }

  if (leaders.length !== 1) return { eliminatedId: null, tie: true };
  return { eliminatedId: leaders[0], tie: false };
}

export function scoreRound(players: readonly Player[], tally: RoundTally): RoundResult {
  const points: Record<string, number> = {};
  for (const p of players) points[p.id] = 0;

  const caught = tally.eliminatedId
    ? players.filter((p) => p.id === tally.eliminatedId && p.role === "odd")
    : [];
  const caughtIds = caught.map((p) => p.id);

  if (tally.tie || !tally.eliminatedId) {
    for (const p of players) if (p.role === "odd") points[p.id] += 1;
    return { ...tally, winners: "none", caughtIds, points };
  }

  if (caughtIds.length > 0) {
    for (const p of players) if (p.role === "civilian") points[p.id] += 1;
    return { ...tally, winners: "civilians", caughtIds, points };
  }

  for (const p of players) if (p.role === "odd") points[p.id] += 2;
  return { ...tally, winners: "odd", caughtIds, points };
}

/**
 * Rotate who gives the first clue so the same player doesn't always lead.
 * Odd players starting first is a real (and fun) disadvantage.
 */
export function clueOrder(players: readonly Player[], roundIndex: number): Player[] {
  if (players.length === 0) return [];
  const offset = roundIndex % players.length;
  return [...players.slice(offset), ...players.slice(0, offset)];
}

export function sanitizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, 18);
}

export function validatePlayerNames(names: readonly string[]): string[] {
  const cleaned = names.map(sanitizeName);
  if (cleaned.length < MIN_PLAYERS) throw new Error(`Need at least ${MIN_PLAYERS} players`);
  if (cleaned.length > MAX_PLAYERS) throw new Error(`At most ${MAX_PLAYERS} players`);
  if (cleaned.some((n) => n.length === 0)) throw new Error("Every player needs a name");
  if (new Set(cleaned.map((n) => n.toLowerCase())).size !== cleaned.length) {
    throw new Error("Player names must be unique");
  }
  return cleaned;
}
