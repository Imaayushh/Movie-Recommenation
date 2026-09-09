# CineMatch — Movie Recommendation System

The C program (`ratings[10][5]`, `struct movie`, `matrix[3][20]`, 4-option `while` menu)
rebuilt as a React + TypeScript app, with the genre rule you asked for:

> **Only when a user gives a top rating (4★ or 5★) do we recommend other movies from that movie's genre.**

## Run it

```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm run test       # 27 logic assertions on the engine (same as `npm run verify`)
npm run typecheck  # tsc --noEmit
npm run build      # production build
```

Your original C source is preserved untouched at `reference/original.c`.

## C → TypeScript mapping

| C | TypeScript |
|---|---|
| `int scify=0 … int comedy=10` | `CATEGORIES` in `src/types.ts` (same ids; 7 = Romance and 11 = Animation added) |
| `struct movie { char moviename[30]; int category; }` | `interface Movie` |
| `char *users[5]` | `USERS` in `src/data/catalog.ts` |
| `int ratings[10][5]` (0 = Not Rated, 1–5 = Rating) | `SEED_RATINGS` — same 50 numbers laid out as 5 users × 10 movies |
| `matrix[3][20]` (`id` / `index` / `ratings`) | `RatingRecord { userId, movieId, rating }` + `buildMatrix()` |
| `case 1: Give your review` | `ReviewPanel.tsx` |
| `case 2: Give Your suggestions` (was empty in C) | `SuggestionsPanel.tsx` — the genre engine |
| `case 3: Top Retings of movies` | `TopRatedPanel.tsx` (plus a raw matrix dump, like the C `printf` loop) |
| `case 4: Exit` | `ExitPanel.tsx` |

Two things were inconsistent in the C source and had to be reconciled:
1. `ratings[10][5]` is 10 users × 5 movies, but there were 5 users and 10 movies. The
   port keeps all 50 values and lays them out as 5 × 10 (C rows 0–4 → movies 0–4, rows 5–9 → movies 5–9).
2. `matrix[3][20]` caps at 20 reviews. The React version stores unlimited ratings in `localStorage`.

## How a suggestion is produced

`src/lib/recommender.ts`, score = `0.6 × genre + 0.3 × collaborative + 0.1 × popularity`.

1. **Genre lift (gated — the main rule).** Movies rated ≥ 4★ add lift to their genre
   (4★ = +1, 5★ = +2). Movies rated ≤ 2★ add drag (2★ = +1, 1★ = +2), subtracted at half weight.
   If the user has **no** 4★+ rating, `unlocked = false` and the genre term is forced to 0.
2. **Collaborative filtering.** Cosine similarity over co-rated movies; picks liked by
   taste twins contribute up to 30%.
3. **Popularity prior.** Global average, mostly a cold-start fallback.

Lift is normalised as `0.6 × (lift / bestGenre) + 0.4 × (lift / (lift + 2))`. The second term
matters: relative normalisation alone made a single 4★ and a single 5★ rank identically,
so rating strength had no effect. This mix keeps 5★ > 4★ while still letting a dominant
genre win, and it saturates so heavy raters don't drown everyone else out.

So a brand-new user sees trending / taste-twin picks with a *"Genre engine locked — rate
any movie 4★ or 5★"* banner. One 5★ on a sci-fi film and the very next render puts
Interstellar, Arrival, Dune, The Matrix and Blade Runner 2049 at the top.

## Tests

`npm run test` runs `scripts/verify.ts` — 27 assertions, no extra dependencies
(esbuild, already bundled with Vite, transpiles it to CJS for plain node). It exits
non-zero on failure. Covered:

- seed data matches the C source row-for-row (`5,2,4,0,3,5,1,4,3,2`)
- the gating rule: locked user gets **zero** genre contribution, one 5★ unlocks it
- 5★ lift > 4★ lift; low ratings de-prioritise a genre
- already-rated movies are never re-recommended; match % is monotone in score
- re-rating overwrites rather than duplicating (mirrors `matrix[2][k] = ratings`)
- surprise-me, empty pool, and unknown-user edge cases

## Suggestion UI

Picks are **grouped by the genre that earned them**, under headings like
*"🚀 More Sci-Fi — because you rated Inception 5★"*. Every card has a **Why this?**
breakdown showing the genre / taste-twin / popularity contribution in points, and
**🎲 Surprise me** deliberately picks from a genre you have no lift in, to avoid an echo chamber.

## Extra features added on top of the C program

- 56-movie catalog (was 10) so same-genre suggestions have real candidates
- Live match % with a "because you rated X 5★" explanation on every card
- Genre filter chips, movie search, min-ratings filter for the leaderboard
- Taste twins panel, low-rating de-prioritisation, click-to-rate straight from a suggestion
- Add new viewers (cold start handled), edit/remove your own ratings
- `localStorage` persistence; Exit resets to the seeded C dataset
