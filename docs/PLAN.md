# Almost — build plan

> A party game where the odd player's word is the **nearest neighbour** of the real word in
> vector space. Built solo for the Appwrite Databases Hackathon (Oct 19–31, 2026).

## The competition

| | |
|---|---|
| Deadline | **31 Oct 2026, 11:59 PM PT** (≈ Nov 1, 08:59 CET / 12:29 IST) |
| Format | Solo, new project built after Oct 19 |
| Requires | One of: TablesDB, DocumentsDB, **VectorsDB**, Managed PostgreSQL, Managed MySQL |
| Submission | Public GitHub repo + 2–3 min demo video (live link optional) |
| Prize | 1st: Appwriter keyboard · 2nd/3rd: Appwrite merch |

### Scoring map — how we win each criterion

| Criterion | Our answer | Where judges see it |
|---|---|---|
| **Idea & innovation** | Word games hand-write their decks. Almost *generates* every decoy from embedding space, so difficulty is a continuous dial and the deck never runs out. | Landing page headline, 20s of the video, the reveal |
| **Technical execution** | Typed round engine, deterministic seeds, server-only API keys, a precomputed neighbour graph, encrypted reveal payloads, calibrated bands. | Repo structure, README, it simply doesn't break live |
| **Design & experience** | Editorial "survey map" identity, pass-the-phone deal flow, a dramatic dark reveal with the meaning map. No AI-purple gradients. | Every screen; especially the reveal |
| **Usage of Appwrite Databases** | TablesDB is load-bearing: the meaning graph is rows, rounds are picked by filtered queries, scoring is a transaction with atomic increments, and the leaderboard is an indexed query. | Architecture section, the tables and transaction shown at 1:35 |

**The one-sentence pitch:** *Almost is a social deduction game whose deck is generated from a
meaning graph — the impostor's word is the closest word in meaning to everyone else's, and the
reveal shows you exactly how close it was.*

## Milestones

### M0 — Foundation (Thu 22 Oct)
- [x] Research rules, judging, TablesDB API
- [x] Repo scaffold, design system, landing page, round engine, word deck
- [x] Port the data layer from VectorsDB to TablesDB (free plan)
- [x] Create project + API key, fill `.env.local`
- [x] `npm run seed` — embed the deck, build the neighbour graph, create tables
- [x] `npm run calibrate` — replace distance bands with rank-based draws
- [x] End-to-end API test: round → vote → transactional scoring → replay guard

### M1 — The game (Fri 23 – Sat 24 Oct)
- [x] `/play` setup: players, deck, spice
- [x] Deal flow (pass the phone, press-and-hold to reveal, no shoulder surfing)
- [x] Clue order + timer
- [x] Vote → reveal (the meaning map, distance, roles)
- [x] Scoring across 3 rounds + final table, persisted in TablesDB
- [ ] Keyboard / screen-reader pass

### M2 — Depth (Sun 25 – Mon 26 Oct)
- [ ] Round history visible: "your last three rounds" from the `rounds` table
- [ ] "Closest call" stat + share card (og image)
- [ ] Deck expansion to 300+ words

### M3 — Ship (Tue 27 – Thu 29 Oct)
- [ ] Deploy to Appwrite Sites
- [ ] README with architecture diagram + setup
- [ ] Record and edit the 2–3 min video with captions
- [ ] Discord post in the hackathon channel

### M4 — Submit early (Fri 30 Oct)
- [ ] Repo public, LICENSE, no secrets, no `research/`
- [ ] Submission copy + tech stack list
- [ ] **Submit** — do not wait for the 31st

## Architecture

```
Build time (npm run seed)
  word list ──► Appwrite Embeddings ──► 768d vectors
                    │
                    └─► pairwise cosine ─► top 40 neighbours per word
                                              │
                                              ▼
                                     TablesDB: words.rows

Runtime
  Browser (Next.js client)  ── no key, no permissions on the tables
      │
      ▼
  Next.js route handlers  ── node-appwrite + APPWRITE_API_KEY
      ├─ listRows(deck, offset)          pick a secret
      ├─ read row.neighbours             choose a decoy in the band
      ├─ createRow(rounds)               record the round
      └─ transaction                      round row + atomic score increments
```

- The decoy is never chosen in the browser.
- The reveal payload is sealed with AES-256-GCM, so distances and roles cannot be forged.
- Every round is reproducible from its seed (good for debugging and for the video).

## Risks and fallbacks

| Risk | Mitigation |
|---|---|
| Appwrite Embeddings unavailable on the Free plan | Generate the vectors locally with a small ONNX model instead; the stored data shape does not change. Only `scripts/seed.ts` changes. |
| Embedding API rate limits while seeding | Batch 25 texts/request. Seed once; rows are upserted. |
| Bad decoys (synonyms, nonsense) | `TOO_CLOSE` guard, calibrated bands, `npm run calibrate`, curated word list, manual spot-check of 50 pairs. |
| Scope creep into online multiplayer | Pass-and-play is the shipped mode. Realtime rooms are a stretch goal only after M2 is green. |
| Demo video rambles | Scripted beats, recorded in one take per beat, captions burned in. |

## Explicit non-goals

- Accounts, friends lists, chat, matchmaking.
- Native apps.
- Custom embedding models.
- Monetisation.

## Video beats (target 2:40)

1. **0:00–0:10** — Cold open: four people, one phone, a laugh. Title card: *Almost*.
2. **0:10–0:25** — The rule in one breath. Everyone has the same word; one has its nearest neighbour.
3. **0:25–1:05** — A real round, fast cuts: dealing, clues, suspicion, a bad bluff.
4. **1:05–1:15** — The vote.
5. **1:15–1:35** — The reveal. Lights down, meaning map opens, the distance is read out loud.
6. **1:35–2:10** — "This is why it needs a database." Show the `words` table in the console, the neighbour row, and the scoring transaction.
7. **2:10–2:25** — New round, new words, difficulty dial. The deck is infinite.
8. **2:25–2:40** — Craft montage, link, sign-off.

## Open questions for Clearance

- Appwrite project ID + endpoint (send after creating the project).
- GitHub repo URL (public, new).
- Preferred video style: voice-over with gameplay, or on-camera host?
