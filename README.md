# Almost

**The party game of near-miss words.** Everyone gets the same secret word — except one player, who
gets its nearest neighbour in meaning. Describe, accuse, and then watch the reveal show exactly how
close the two words were.

Built solo for the [Appwrite Databases Hackathon](https://hackathon.appwrite.io), October 2026.
Runs entirely on **Appwrite TablesDB** — no vector service, no external AI key.

> Status: in active development. The round engine, data layer, landing page, and the full
> pass-and-play loop are in place; deployment and video come next.

## How it works

Every word in the deck is stored once in TablesDB with its 768-dimension embedding and its 40
nearest neighbours (cosine distance), computed at build time with Appwrite's `nomic-embed-text`
model.

A round is built like this:

1. Pick a random row from the `words` table, filtered by deck.
2. Read that row's precomputed neighbour list.
3. Keep the neighbours inside the current **spice band** (`0.36 – 0.55` by default).
4. Deal one as the odd player's word.

The distance is the difficulty dial, and it is also the reveal: players see the exact cosine
distance that decided the round.

Rounds and scores are stored in the same database. Finishing a round is a **transaction**: the round
row and every player's counter are written with **atomic increments**, all or nothing.

### Data model

| Table | Columns | Used for |
|---|---|---|
| `words` | `word`, `deck`, `embedding`, `neighbours` | The meaning graph |
| `rounds` | `gameId`, `roundIndex`, `deck`, `spice`, `secret`, `decoy`, `distance`, `accused`, `outcome` | Round history |
| `scores` | `gameId`, `player`, `points`, `caught` | Leaderboard, atomic increments |

## Stack

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Data | Appwrite TablesDB |
| Embeddings | Appwrite Embeddings (build time only) |
| Deploy | Appwrite Sites |

## Local development

```bash
npm install
cp .env.example .env.local   # endpoint, project id, API key
npm run seed                 # embeddings + neighbour graph + tables
npm run check-db             # verify connectivity and read a graph
npm run dev
```

Useful scripts:

- `npm run seed -- --reset` rebuilds the tables from scratch.
- `npm run calibrate` prints the neighbour graph and checks band coverage.
- `npm run calibrate -- lantern lighthouse` shows one pair's cosine distance.

The API key is only read on the server. There are no `NEXT_PUBLIC_` secrets, and the tables grant no
client permissions — every read and write goes through a Next.js route handler.

## Repository layout

```
app/            routes, pages, API handlers
components/     UI, including the meaning map
lib/            game engine, TablesDB access, schema, sealing
data/words.json the word deck
scripts/        seeding, calibration, database checks
docs/           game design and build plan
```

## License

MIT
