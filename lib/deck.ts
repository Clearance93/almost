import raw from "@/data/words.json";
import type { Deck, WordData, WordEntry } from "./types";

const data = raw as WordData;

export const decks: Deck[] = data.decks;

export function wordsInDeck(deckId: string): WordEntry[] {
  return deckId === "any" ? data.words : data.words.filter((w) => w.deck === deckId);
}

export function deckById(deckId: string): Deck | undefined {
  return data.decks.find((d) => d.id === deckId);
}
