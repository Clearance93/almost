"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MeaningMap, type MapPoint } from "@/components/MeaningMap";
import { decks } from "@/lib/deck";
import { SPICE_BANDS } from "@/lib/game";
import type {
  LeaderboardEntry,
  RevealPayload,
  RoundResponse,
  RoundResult,
  Spice,
} from "@/lib/types";

type Stage = "setup" | "dealing" | "clues" | "voting" | "reveal" | "final";

const ROUNDS = 3;
const CLUE_SECONDS = 60;
const SPICE_COPY: Record<Spice, string> = {
  mild: "Close neighbours. Easy to bluff.",
  medium: "The table starts to disagree.",
  hot: "Barely related. Good luck.",
};

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-sm text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";
const primary = `${buttonBase} bg-ink px-6 py-3.5 text-paper hover:bg-vermilion`;
const ghost = `${buttonBase} border border-ink/25 px-5 py-3 text-ink hover:bg-ink/5`;

export function PlayGame() {
  const [stage, setStage] = useState<Stage>("setup");
  const [names, setNames] = useState<string[]>(["", "", "", ""]);
  const [deck, setDeck] = useState("any");
  const [spice, setSpice] = useState<Spice>("medium");

  const [round, setRound] = useState<RoundResponse | null>(null);
  const [roundNumber, setRoundNumber] = useState(1);
  const [gameId, setGameId] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const [cardIndex, setCardIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [hasSeen, setHasSeen] = useState(false);

  const [seconds, setSeconds] = useState(CLUE_SECONDS);
  const [suspectId, setSuspectId] = useState<string | null>(null);

  const [reveal, setReveal] = useState<RevealPayload | null>(null);
  const [outcome, setOutcome] = useState<RoundResult | null>(null);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanNames = names.map((n) => n.trim()).filter(Boolean);
  const uniqueNames = new Set(cleanNames.map((n) => n.toLowerCase())).size === cleanNames.length;
  const canStart =
    cleanNames.length >= 4 && cleanNames.length === names.length && uniqueNames && !pending;

  useEffect(() => {
    if (stage !== "clues") return;
    setSeconds(CLUE_SECONDS);
    const id = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [stage, roundNumber]);

  const startRound = useCallback(
    async (overrideNames?: string[], roundIndex = 0) => {
      const playerNames = overrideNames ?? names.map((n) => n.trim());
      setPending(true);
      setError(null);
      try {
        const response = await fetch("/api/round", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            deck,
            spice,
            names: playerNames,
            gameId: gameId ?? undefined,
            roundIndex,
          }),
        });
        const data = (await response.json()) as RoundResponse & { error?: string };
        if (!response.ok) throw new Error(data.error ?? "The word map did not answer");

        setRound(data);
        setGameId(data.gameId);
        setCardIndex(0);
        setRevealed(false);
        setHasSeen(false);
        setSuspectId(null);
        setReveal(null);
        setOutcome(null);
        setStage("dealing");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not start the round");
      } finally {
        setPending(false);
      }
    },
    [deck, gameId, names, spice],
  );

  async function openReveal() {
    if (!round || !suspectId) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/round/finish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sealed: round.sealed, accusedPlayerId: suspectId }),
      });
      const data = (await response.json()) as {
        reveal: RevealPayload;
        result: RoundResult;
        leaderboard: LeaderboardEntry[];
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "The reveal could not be opened");

      setReveal(data.reveal);
      setOutcome(data.result);
      setLeaderboard(data.leaderboard);
      setStage("reveal");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open the reveal");
    } finally {
      setPending(false);
    }
  }

  function nextRound() {
    if (roundNumber >= ROUNDS) {
      setStage("final");
      return;
    }
    setRoundNumber((n) => n + 1);
    void startRound(names.map((n) => n.trim()), roundNumber);
  }

  function reset() {
    setStage("setup");
    setRound(null);
    setRoundNumber(1);
    setGameId(null);
    setLeaderboard([]);
    setReveal(null);
    setOutcome(null);
    setSuspectId(null);
    setError(null);
  }

  const card = round?.cards[cardIndex];
  const mapPoints: MapPoint[] = useMemo(() => {
    if (!reveal) return [];
    const points = reveal.neighbours
      .slice(0, 7)
      .map((n) => ({ label: n.word, distance: n.distance }) as MapPoint);
    if (!points.some((p) => p.label === reveal.decoy)) {
      points.push({ label: reveal.decoy, distance: reveal.distance });
    }
    return points.map((p) =>
      p.label === reveal.decoy ? { ...p, tone: "odd" as const } : p,
    );
  }, [reveal]);

  return (
    <div
      data-theme={stage === "reveal" ? "night" : undefined}
      className="min-h-dvh bg-paper text-ink transition-colors duration-500"
    >
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-serif text-xl">almost</span>
          <span className="h-1 w-1 rounded-full bg-vermilion" />
        </Link>
        <div className="flex items-center gap-4">
          {stage !== "setup" ? (
            <span className="label">
              Round {Math.min(roundNumber, ROUNDS)} / {ROUNDS}
            </span>
          ) : (
            <span className="label">4–10 players</span>
          )}
          {stage !== "setup" ? (
            <button onClick={reset} className="label hover:text-ink">
              Restart
            </button>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 pb-20 sm:px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={stage}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            {error ? (
              <p className="mb-5 rounded-sm border border-vermilion/40 bg-vermilion/5 px-4 py-3 text-[13px] text-vermilion">
                {error}
              </p>
            ) : null}

            {stage === "setup" ? (
              <Setup
                names={names}
                setNames={setNames}
                deck={deck}
                setDeck={setDeck}
                spice={spice}
                setSpice={setSpice}
                canStart={canStart}
                pending={pending}
                onStart={() => void startRound(undefined, 0)}
              />
            ) : null}

            {stage === "dealing" && card && round ? (
              <Dealing
                round={round}
                card={card}
                index={cardIndex}
                revealed={revealed}
                hasSeen={hasSeen}
                onHold={(value) => {
                  setRevealed(value);
                  if (value) setHasSeen(true);
                }}
                onNext={() => {
                  if (cardIndex + 1 >= round.cards.length) {
                    setStage("clues");
                    return;
                  }
                  setCardIndex((i) => i + 1);
                  setRevealed(false);
                  setHasSeen(false);
                }}
              />
            ) : null}

            {stage === "clues" && round ? (
              <Clues
                round={round}
                seconds={seconds}
                onVote={() => setStage("voting")}
              />
            ) : null}

            {stage === "voting" && round ? (
              <Voting
                round={round}
                suspectId={suspectId}
                setSuspectId={setSuspectId}
                pending={pending}
                onConfirm={() => void openReveal()}
              />
            ) : null}

            {stage === "reveal" && reveal && outcome ? (
              <Reveal
                reveal={reveal}
                outcome={outcome}
                mapPoints={mapPoints}
                roundNumber={roundNumber}
                onNext={nextRound}
              />
            ) : null}

            {stage === "final" ? (
              <Final leaderboard={leaderboard} onAgain={reset} />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function Setup({
  names,
  setNames,
  deck,
  setDeck,
  spice,
  setSpice,
  canStart,
  pending,
  onStart,
}: {
  names: string[];
  setNames: (names: string[]) => void;
  deck: string;
  setDeck: (deck: string) => void;
  spice: Spice;
  setSpice: (spice: Spice) => void;
  canStart: boolean;
  pending: boolean;
  onStart: () => void;
}) {
  return (
    <div className="pt-4">
      <p className="label">Set the table</p>
      <h1 className="mt-4 max-w-xl font-serif text-[clamp(2.2rem,5vw,3.4rem)] leading-[1.02] tracking-tight">
        One of you will get the wrong word.
      </h1>
      <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-soft">
        Everyone shares a secret word. The odd player gets its nearest neighbour in meaning. Give
        one clue each, then vote.
      </p>

      <div className="mt-10 grid gap-8 border-t border-ink/15 pt-8 sm:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="label">The table · {names.length}</h2>
            <div className="flex gap-1">
              <button
                type="button"
                aria-label="Remove a player"
                disabled={names.length <= 4}
                onClick={() => setNames(names.slice(0, -1))}
                className="h-7 w-7 rounded-sm border border-ink/20 text-ink transition-colors hover:bg-ink/5 disabled:opacity-30"
              >
                −
              </button>
              <button
                type="button"
                aria-label="Add a player"
                disabled={names.length >= 10}
                onClick={() => setNames([...names, ""])}
                className="h-7 w-7 rounded-sm border border-ink/20 text-ink transition-colors hover:bg-ink/5 disabled:opacity-30"
              >
                +
              </button>
            </div>
          </div>

          <ul className="mt-3 space-y-2">
            {names.map((name, index) => (
              <li key={index} className="flex items-center gap-3">
                <span className="w-4 font-mono text-[10px] text-ink-soft">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <input
                  value={name}
                  onChange={(event) => {
                    const next = [...names];
                    next[index] = event.target.value;
                    setNames(next);
                  }}
                  placeholder={`Player ${index + 1}`}
                  maxLength={18}
                  autoComplete="off"
                  className="w-full rounded-sm border border-ink/20 bg-transparent px-3 py-2.5 text-[15px] outline-none transition-colors placeholder:text-ink-soft/60 focus:border-ink/60"
                />
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-7">
          <div>
            <h2 className="label">The deck</h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[{ id: "any", name: "Anything" }, ...decks].map((d) => (
                <button
                  key={d.id}
                  type="button"
                  aria-pressed={deck === d.id}
                  onClick={() => setDeck(d.id)}
                  className={`rounded-sm border px-2.5 py-1.5 text-[12px] transition-colors ${
                    deck === d.id
                      ? "border-ink bg-ink text-paper"
                      : "border-ink/20 text-ink-soft hover:border-ink/50 hover:text-ink"
                  }`}
                >
                  {d.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="label">Spice</h2>
            <div className="mt-3 space-y-1.5">
              {(["mild", "medium", "hot"] as const).map((level) => {
                const band = SPICE_BANDS[level];
                return (
                  <button
                    key={level}
                    type="button"
                    aria-pressed={spice === level}
                    onClick={() => setSpice(level)}
                    className={`flex w-full items-center justify-between gap-3 rounded-sm border px-3 py-2.5 text-left transition-colors ${
                      spice === level
                        ? "border-vermilion bg-vermilion/5"
                        : "border-ink/20 hover:border-ink/45"
                    }`}
                  >
                    <span>
                      <span className="block text-[13px] font-medium capitalize">{level}</span>
                      <span className="block text-[11px] text-ink-soft">{SPICE_COPY[level]}</span>
                    </span>
                    <span className="font-mono text-[10px] text-ink-soft">
                      {band.min.toFixed(2)}–{band.max.toFixed(2)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-9 flex items-center justify-between gap-4 border-t border-ink/15 pt-6">
        <p className="max-w-xs text-[12px] leading-relaxed text-ink-soft">
          One phone. Pass it around to deal, then put it face down in the middle.
        </p>
        <button onClick={onStart} disabled={!canStart} className={primary}>
          {pending ? "Finding a neighbour…" : "Deal the round"}
          <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}

function Dealing({
  round,
  card,
  index,
  revealed,
  hasSeen,
  onHold,
  onNext,
}: {
  round: RoundResponse;
  card: { playerId: string; name: string; word: string };
  index: number;
  revealed: boolean;
  hasSeen: boolean;
  onHold: (value: boolean) => void;
  onNext: () => void;
}) {
  const last = index + 1 >= round.cards.length;

  return (
    <div className="pt-6">
      <div className="flex items-center justify-between">
        <span className="label">
          Card {index + 1} of {round.cards.length}
        </span>
        <span className="label">
          {round.spice} · {decks.find((d) => d.id === round.deck)?.name ?? "Anything"}
        </span>
      </div>

      <h2 className="mt-6 font-serif text-[clamp(1.9rem,4.5vw,2.8rem)] leading-tight">
        Pass the phone to <span className="italic text-vermilion">{card.name}</span>.
      </h2>
      <p className="mt-2 text-[14px] text-ink-soft">
        Press and hold to look. Let go and it hides again.
      </p>

      <div className="mt-8 flex justify-center">
        <button
          type="button"
          aria-label={`Hold to reveal ${card.name}'s word`}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            onHold(true);
          }}
          onPointerUp={() => onHold(false)}
          onPointerCancel={() => onHold(false)}
          onPointerLeave={() => onHold(false)}
          onContextMenu={(event) => event.preventDefault()}
          onKeyDown={(event) => {
            if (event.key === " " || event.key === "Enter") {
              event.preventDefault();
              onHold(true);
            }
          }}
          onKeyUp={(event) => {
            if (event.key === " " || event.key === "Enter") onHold(false);
          }}
          className={`relative flex h-[300px] w-full max-w-[320px] select-none flex-col items-center justify-center rounded-sm border transition-colors ${
            revealed
              ? "border-ink bg-ink text-paper"
              : "border-ink/25 bg-paper-2/60 text-ink"
          }`}
          style={{ touchAction: "none", WebkitUserSelect: "none" }}
        >
          <span className={`label ${revealed ? "text-paper/60" : ""}`}>
            {revealed ? "your word" : "press and hold"}
          </span>
          <span
            className={`mt-4 px-6 text-center font-serif leading-none transition-opacity ${
              revealed ? "text-[clamp(2.4rem,9vw,3.6rem)] opacity-100" : "text-[13px] opacity-40"
            }`}
          >
            {revealed ? card.word : "••••••"}
          </span>
          <span className={`absolute bottom-4 label ${revealed ? "text-paper/50" : ""}`}>
            {revealed ? "release to hide" : card.name}
          </span>
        </button>
      </div>

      <div className="mt-8 flex justify-center">
        <button onClick={onNext} disabled={!hasSeen} className={primary}>
          {last ? "Everyone has seen their word" : "Next player"}
          <span aria-hidden>→</span>
        </button>
      </div>
      <p className="mt-3 text-center text-[11px] text-ink-soft">
        {hasSeen ? "Remember it. Don't say it." : "Look at your word before you pass the phone."}
      </p>
    </div>
  );
}

function Clues({
  round,
  seconds,
  onVote,
}: {
  round: RoundResponse;
  seconds: number;
  onVote: () => void;
}) {
  const starter = round.players[round.seed % round.players.length];
  const order = [...round.players];
  const startAt = order.findIndex((p) => p.id === starter.id);
  const ordered = [...order.slice(startAt), ...order.slice(0, startAt)];
  const progress = (seconds / CLUE_SECONDS) * 100;

  return (
    <div className="pt-6">
      <span className="label">The clue round</span>
      <h2 className="mt-4 font-serif text-[clamp(2rem,4.6vw,2.9rem)] leading-tight">
        One clue each. No saying the word.
      </h2>

      <div className="mt-8 rounded-sm border border-ink/15 p-5">
        <div className="flex items-baseline justify-between">
          <span className="label">Speaking order</span>
          <span className="font-mono text-[11px] text-ink-soft">{starter.name} starts</span>
        </div>
        <ol className="mt-4 grid gap-2 sm:grid-cols-2">
          {ordered.map((player, index) => (
            <li key={player.id} className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-ink/20 font-mono text-[10px]">
                {index + 1}
              </span>
              <span className="text-[14px]">{player.name}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-6">
        <div className="flex items-baseline justify-between">
          <span className="label">Discussion</span>
          <span className="font-mono text-[12px]">
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
          </span>
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-ink/10">
          <div
            className="h-full bg-vermilion transition-[width] duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-3 text-[12px] text-ink-soft">
          Give a clue that proves you know the word — without handing it to the impostor.
        </p>
      </div>

      <div className="mt-9 flex justify-end">
        <button onClick={onVote} className={primary}>
          Call the vote
          <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}

function Voting({
  round,
  suspectId,
  setSuspectId,
  pending,
  onConfirm,
}: {
  round: RoundResponse;
  suspectId: string | null;
  setSuspectId: (id: string) => void;
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <div className="pt-6">
      <span className="label">The vote</span>
      <h2 className="mt-4 font-serif text-[clamp(2rem,4.6vw,2.9rem)] leading-tight">
        Who had the almost word?
      </h2>
      <p className="mt-2 text-[14px] text-ink-soft">
        One tap for the table. Everyone points, one person commits.
      </p>

      <div className="mt-8 grid gap-2 sm:grid-cols-2">
        {round.players.map((player) => {
          const active = suspectId === player.id;
          return (
            <button
              key={player.id}
              type="button"
              aria-pressed={active}
              onClick={() => setSuspectId(player.id)}
              className={`flex items-center justify-between rounded-sm border px-4 py-4 text-left transition-colors ${
                active
                  ? "border-vermilion bg-vermilion text-paper"
                  : "border-ink/20 hover:border-ink/60"
              }`}
            >
              <span className="text-[15px]">{player.name}</span>
              <span
                className={`font-mono text-[10px] ${active ? "text-paper/70" : "text-ink-soft"}`}
              >
                {active ? "accused" : "vote"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-9 flex items-center justify-between gap-4">
        <p className="max-w-[16rem] text-[11px] leading-relaxed text-ink-soft">
          A tie means nobody leaves the table, and the odd player gets away with it.
        </p>
        <button onClick={onConfirm} disabled={!suspectId || pending} className={primary}>
          {pending ? "Opening…" : "Open the reveal"}
          <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}

function Reveal({
  reveal,
  outcome,
  mapPoints,
  roundNumber,
  onNext,
}: {
  reveal: RevealPayload;
  outcome: RoundResult;
  mapPoints: MapPoint[];
  roundNumber: number;
  onNext: () => void;
}) {
  const caught = outcome.caughtIds
    .map((id) => reveal.players.find((p) => p.id === id)?.name)
    .filter(Boolean);

  return (
    <div className="pt-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-center justify-between">
          <span className="label text-ink-soft">Round {roundNumber} · the reveal</span>
          <span className="label text-ink-soft">{reveal.engine.model}</span>
        </div>

        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mt-8 font-serif text-[clamp(2.2rem,6vw,3.8rem)] leading-[0.98]"
        >
          The word was <span className="italic">{reveal.secret}</span>.
        </motion.h2>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-2 border-t border-ink/15 pt-6"
        >
          <span className="label text-ink-soft">The almost word</span>
          <span className="font-serif text-[clamp(1.8rem,5vw,2.8rem)] italic text-vermilion">
            {reveal.decoy}
          </span>
          <span className="font-mono text-[11px] text-ink-soft">
            cosine distance {reveal.distance.toFixed(3)}
          </span>
        </motion.div>

        <div className="mt-8 grid gap-8 sm:grid-cols-[1fr_1fr] sm:items-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.8 }}
            className="map-grid rounded-sm border border-ink/15 bg-paper-2/40 p-2"
          >
            <MeaningMap center={reveal.secret} points={mapPoints} className="h-auto w-full" />
          </motion.div>

          <div>
            <p className="label text-ink-soft">Verdict</p>
            <p className="mt-3 font-serif text-[26px] leading-tight">
              {outcome.winners === "civilians"
                ? `Caught. ${caught.join(" and ")} had the almost word.`
                : outcome.winners === "odd"
                  ? "Wrong call. The odd player walks away."
                  : "Nobody leaves the table."}
            </p>

            <ul className="mt-6 space-y-2">
              {reveal.players.map((player) => (
                <li
                  key={player.id}
                  className="flex items-center justify-between border-t border-ink/10 py-2"
                >
                  <span className="text-[14px]">{player.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-serif text-[15px] italic text-ink-soft">
                      {player.word}
                    </span>
                    <span
                      className={`rounded-sm px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${
                        player.role === "odd"
                          ? "bg-vermilion text-paper"
                          : "border border-ink/20 text-ink-soft"
                      }`}
                    >
                      {player.role === "odd" ? "odd" : "civilian"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-6 flex items-center justify-between border-t border-ink/15 pt-4">
              <span className="label text-ink-soft">Points this round</span>
              <span className="font-mono text-[11px] text-ink-soft">
                {Object.values(outcome.points).reduce((a, b) => a + b, 0)} awarded
              </span>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-ink/15 pt-6">
          <p className="max-w-sm text-[11px] leading-relaxed text-ink-soft">
            {reveal.engine.candidates} neighbours searched · {reveal.engine.pool} inside the{" "}
            {reveal.spice} band ({reveal.engine.band.min.toFixed(2)}–
            {reveal.engine.band.max.toFixed(2)}) · HNSW cosine
          </p>
          <button onClick={onNext} className={primary}>
            {roundNumber >= ROUNDS ? "Final score" : "Next round"}
            <span aria-hidden>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Final({
  leaderboard,
  onAgain,
}: {
  leaderboard: LeaderboardEntry[];
  onAgain: () => void;
}) {
  const ranked = [...leaderboard].sort(
    (a, b) => b.points - a.points || a.caught - b.caught,
  );
  const top = ranked[0]?.points ?? 0;
  const leaders = ranked.filter((entry) => entry.points === top);

  return (
    <div className="pt-8">
      <span className="label">After three rounds</span>
      <h2 className="mt-4 font-serif text-[clamp(2.2rem,5.5vw,3.4rem)] leading-none">
        {leaders.length > 1
          ? "A shared crown."
          : `${ranked[0]?.player ?? "Nobody"} reads the table.`}
      </h2>

      <ol className="mt-10 border-t border-ink/15">
        {ranked.map((entry, index) => (
          <li
            key={entry.player}
            className="flex items-center justify-between border-b border-ink/10 py-4"
          >
            <span className="flex items-baseline gap-4">
              <span className="font-mono text-[11px] text-ink-soft">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span
                className={`font-serif text-[22px] ${
                  entry.points === top ? "italic" : ""
                }`}
              >
                {entry.player}
              </span>
            </span>
            <span className="flex items-baseline gap-3">
              <span className="label">
                {entry.caught === 0 ? "never caught" : `caught ${entry.caught}×`}
              </span>
              <span className="font-mono text-[13px]">{entry.points} pts</span>
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-4 text-[11px] text-ink-soft">
        Scores were written to Appwrite TablesDB in a transaction — refresh-safe, device-safe.
      </p>

      <div className="mt-9 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="text-[13px] text-ink-soft underline decoration-ink/25 underline-offset-4 hover:text-ink"
        >
          Back to the map
        </Link>
        <button onClick={onAgain} className={primary}>
          Play again <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}
