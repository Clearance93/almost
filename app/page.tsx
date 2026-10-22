import Link from "next/link";
import { MeaningMap } from "@/components/MeaningMap";
import { SPICE_RANKS } from "@/lib/game";

const samplePoints = [
  { label: "candle", distance: 0.21 },
  { label: "torch", distance: 0.29 },
  { label: "lighthouse", distance: 0.34, tone: "odd" as const },
  { label: "beacon", distance: 0.41 },
  { label: "harbour", distance: 0.52 },
  { label: "porch", distance: 0.58 },
];

const steps = [
  {
    n: "01",
    title: "Everyone gets a word",
    body: "All but one player receive the same secret word. The odd player receives its nearest neighbour — a word that is almost right.",
  },
  {
    n: "02",
    title: "One clue each",
    body: "Go around the table. Describe your word without saying it. The odd player has to bluff a word they have never seen.",
  },
  {
    n: "03",
    title: "Vote, then open the map",
    body: "Find the impostor. Then the lights go down and you see how close the two words really were — and who was lying.",
  },
];

const rails = [
  {
    title: "An endless deck",
    body: "There is no hand-written list of pairs to run out of. Every round is mined from the semantic neighbourhood of a word.",
  },
  {
    title: "Difficulty is a distance",
    body: "Mild pairs sit close, so bluffing is easy. Hot pairs drift apart. One number changes the whole table.",
  },
  {
    title: "Every round is explainable",
    body: "The reveal is not a black box. It shows the real cosine distance between the two words, straight from the database.",
  },
];

export default function Home() {
  return (
    <main className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="font-serif text-2xl tracking-tight">almost</span>
          <span className="h-1.5 w-1.5 translate-y-[-2px] rounded-full bg-vermilion transition-transform group-hover:scale-150" />
        </Link>
        <nav className="flex items-center gap-6">
          <a href="#how" className="label hidden hover:text-ink sm:block">
            How it plays
          </a>
          <a href="#engine" className="label hidden hover:text-ink sm:block">
            The engine
          </a>
          <a
            href="#how"
            className="rounded-sm bg-ink px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-vermilion"
          >
            Play a round
          </a>
        </nav>
      </header>

      <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 pb-16 pt-8 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:pb-24 lg:pt-14">
        <div>
          <p className="label flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-vermilion" />
            Appwrite Databases Hackathon · TablesDB
          </p>

          <h1 className="mt-6 font-serif text-[clamp(2.9rem,6.4vw,5.4rem)] leading-[0.94] tracking-[-0.02em]">
            One of you has the <em className="text-vermilion">almost</em> right word.
          </h1>

          <p className="mt-7 max-w-xl text-[17px] leading-relaxed text-ink-soft">
            <strong className="font-medium text-ink">Almost</strong> is a social deduction game
            with a deck that writes itself. The odd player&rsquo;s word is not random and not
            hand-picked — it is the nearest neighbour of the real word in vector space. Close
            enough to bluff. Far enough to get caught.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <a
              href="#how"
              className="group inline-flex items-center gap-3 rounded-sm bg-ink px-6 py-3.5 text-sm font-medium text-paper transition-colors hover:bg-vermilion"
            >
              Start a round
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </a>
            <a
              href="#engine"
              className="text-sm text-ink-soft underline decoration-ink/25 underline-offset-4 transition-colors hover:text-ink"
            >
              How the decoy is chosen
            </a>
          </div>

          <dl className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-ink/15 pt-5">
            {[
              ["Players", "4–10"],
              ["Needs", "one phone"],
              ["A round", "10 min"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline gap-2">
                <dt className="label">{k}</dt>
                <dd className="font-mono text-[12px] text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative">
          <div className="map-grid relative rounded-sm border border-ink/15 bg-paper-2/60 p-4 sm:p-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="label">Round 03 · Hot</span>
              <span className="label">cosine distance</span>
            </div>
            <MeaningMap center="lantern" points={samplePoints} className="h-auto w-full" />
            <div className="mt-2 flex items-center justify-between border-t border-ink/10 pt-3">
              <span className="label">6 neighbours returned</span>
              <span className="label">tablesdb · 768d</span>
            </div>
          </div>
          <p className="mt-3 text-center text-[12px] text-ink-soft">
            <span className="font-serif italic">lantern</span>, and five words that live near it.
          </p>
        </div>
      </section>

      <section id="how" className="border-y border-ink/15 bg-paper-2/40">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
          <div className="flex items-end justify-between gap-8">
            <h2 className="max-w-2xl font-serif text-[clamp(2rem,4vw,3.1rem)] leading-[1.02] tracking-tight">
              Three rounds, one liar, no cards to shuffle.
            </h2>
            <span className="label hidden sm:block">01 — how it plays</span>
          </div>

          <ol className="mt-12 grid gap-8 sm:grid-cols-3 sm:gap-6">
            {steps.map((step) => (
              <li key={step.n} className="border-t border-ink/20 pt-5">
                <span className="label">{step.n}</span>
                <h3 className="mt-4 font-serif text-[26px] leading-tight">{step.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="engine" className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
          <div>
            <span className="label">02 — the engine</span>
            <h2 className="mt-4 font-serif text-[clamp(2rem,4vw,3.1rem)] leading-[1.02] tracking-tight">
              The deck is a table, not a list.
            </h2>
            <p className="mt-6 text-[16px] leading-relaxed text-ink-soft">
              Each word is stored once in Appwrite TablesDB with its 768-dimension embedding and
              its 40 nearest neighbours, computed at build time with Appwrite&rsquo;s embedding
              model. To deal a round, the server picks a row at random, reads its neighbour list,
              and draws a decoy from the top of it.
            </p>
            <p className="mt-4 text-[16px] leading-relaxed text-ink-soft">
              Spice decides how deep into that list the game is allowed to go. Rounds and scores
              land in the same database — scoring is a transaction with atomic increments, so a
              round can never half-count.
            </p>

            <pre className="mt-8 overflow-x-auto rounded-sm border border-ink/15 bg-ink px-5 py-4 text-[12px] leading-relaxed text-paper/85">
              <code>{`// 1. pick a secret row from TablesDB
Query.equal("deck", deck)
Query.offset(random)

// 2. draw a decoy from its neighbour list
const pool = row.neighbours.slice(rankFrom, rankTo)
const decoy = pool[randomIndex]

// 3. score the round atomically
incrementRowColumn({ column: "points", value: 1 })`}</code>
            </pre>
          </div>

          <div className="space-y-5">
            {(
              [
                ["Mild", "mild", "Nearest neighbours. The odd player blends right in."],
                ["Medium", "medium", "A step or two out. The table starts to argue."],
                ["Hot", "hot", "Deep in the graph. Every clue feels slightly wrong."],
              ] as const
            ).map(([name, key, note]) => {
              const rank = SPICE_RANKS[key];
              return (
                <div key={key} className="rounded-sm border border-ink/15 bg-paper-2/50 p-5">
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-serif text-xl">{name}</h3>
                    <span className="font-mono text-[11px] text-ink-soft">
                      {rank.from === 0 ? "#1" : `#${rank.from + 1}–#${rank.to}`}
                    </span>
                  </div>
                  <div className="mt-4 flex gap-1" aria-hidden>
                    {Array.from({ length: 10 }).map((_, index) => (
                      <span
                        key={index}
                        className={`h-7 flex-1 rounded-[2px] ${
                          index >= rank.from && index < rank.to ? "bg-vermilion" : "bg-ink/10"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="mt-2 flex justify-between">
                    <span className="label">closest</span>
                    <span className="label">10th neighbour</span>
                  </div>
                  <p className="mt-3 text-[14px] text-ink-soft">{note}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          {rails.map((rail) => (
            <div key={rail.title} className="border-t border-ink/20 pt-5">
              <h3 className="font-serif text-[22px]">{rail.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{rail.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-ink/15">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-3">
            <span className="font-serif text-lg">almost</span>
            <span className="label">Built for the Appwrite Databases Hackathon · Oct 2026</span>
          </div>
          <div className="flex items-center gap-5">
            <span className="label">TablesDB · Embeddings</span>
            <span className="label">Solo entry</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
