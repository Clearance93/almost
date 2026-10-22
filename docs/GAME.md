# Almost — game design

*The party game of near-miss words.*

## The idea in one line

Everyone at the table gets the same secret word — except one player, who gets a word that is
**almost** the same: the nearest neighbour of the real word in embedding space.

## Why a vector database

Traditional social deduction games ship with a hand-written deck: `cat / dog`, `beach / desert`.
That deck is finite, uneven, and the difficulty is whatever the author guessed.

In Almost there is no deck. Each word is stored once as a 768-dimension embedding. To build a round:

1. Take the secret word's vector.
2. Ask VectorsDB for its nearest neighbours, ranked by cosine distance.
3. Keep the neighbours inside a **spice band** (e.g. `0.36 – 0.55`).
4. Deal one at random as the decoy.

The consequences are the product:

- **Infinite content** — every word in the collection is a potential round.
- **A real difficulty dial** — move the band and the table gets harder.
- **An honest reveal** — the exact distance that decided the round is shown to the players.

## Players and roles

| | |
|---|---|
| Players | 4–10, one shared device (pass-and-play) |
| Odd players | 1 at 4–6 players · 2 at 7–8 · 3 at 9–10 |
| Civilians | Everyone else — they all hold the real word |
| Duration | ~10 minutes for 3 rounds |

## A round

1. **Deal** — The phone names the next player. They press and hold to see their card, release to
   hide it, then pass the phone. Roles are never on screen for longer than a thumb press.
2. **Clue** — The app picks a starting player. Going clockwise, each player says one word or short
   phrase about their word. No saying the word itself, no spelling, no translations.
3. **Discuss** — 60 seconds of accusations. The odd player is improvising; the civilians are
   describing something they can actually see.
4. **Vote** — Everyone taps a suspect on the shared phone. Majority removes one player.
5. **Reveal** — The lights go down. The real word, the odd word, their distance, and the meaning
   map. Then the roles.

## Scoring

| Outcome | Points |
|---|---|
| The odd player is voted out | +1 to every civilian |
| A civilian is voted out | +2 to every odd player |
| Tie / no elimination | +1 to every odd player (they survived) |

Three rounds. Highest total wins. Ties break on "fewest times caught as the odd player", then on
the closest surviving distance.

## Spice bands

Cosine *distance*: `0` means identical meaning. Appwrite's `nomic-embed-text` puts
`lantern → candle` around `0.20`, and `lantern → lighthouse` around `0.34`.

| Spice | Band | Feel |
|---|---|---|
| Mild | `0.26 – 0.42` | Close neighbours. Easy to bluff, easy to blend in. |
| Medium | `0.36 – 0.55` | The table starts to disagree. Default. |
| Hot | `0.48 – 0.68` | Barely related. The odd player has to work. |

Guards: anything under `0.14` is treated as a synonym and never dealt. Anything over `0.78` is
too obviously unrelated. `npm run calibrate` prints live distances so these numbers stay honest.

## Decoy quality rules

A good decoy is:

- **describable** — it has enough concrete features to bluff about;
- **adjacent, not nested** — `lantern` / `lighthouse` is good; `lantern` / `lamp` is a synonym;
- **not a plural or derived form** of the secret;
- **surprising** — a different category is often a *better* round than a sibling object.

The seed script stores `word` and `deck` in document metadata; deck can be used for filters and for
"same category / different category" round styles later.

## UX states

```
landing → setup → deal (per player) → clue order → timer
       → vote → reveal → round score → next round → final table
```

- Deal and vote are the only places where privacy matters. Deal uses press-and-hold; vote is a
  single tap with the accused shown large.
- The reveal is the signature moment: warm paper flips to ink, the map draws, the distance counts
  up, then the roles land one by one.
- Reduced-motion users get the same information without the choreography.

## Edge cases

- **Tie vote** → nobody leaves; odd players score.
- **No candidates in band** → take the closest usable neighbour and widen the band next round.
- **Duplicate player names** → blocked at setup with an inline error.
- **Refresh mid-round** → the round is stored server-side and can be resumed by round id.
- **2 odd players** → catching either one counts as a civilian win for the round.

## Naming

*Almost* — short, says the mechanic, works as a verb at the table ("you're almost right"), and
gives the UI its language: *the almost word*, *the almost map*, *caught almost*.
