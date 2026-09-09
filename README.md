# CineMatch — Movie Recommendation System

A movie recommendation system built as a **static site: plain HTML, CSS and JavaScript**.
No framework, no build step, no `npm install` — open `index.html` and it runs.

The core rule, carried over from the original C program:

> **Only when a user gives a top rating (4★ or 5★) do we recommend other movies from that movie's genre.**

---

## Run it locally

Just open the file:

```bash
# double-click index.html, or serve the folder:
python -m http.server 8000     # http://localhost:8000
npx serve .                    # or any static server
```

No dependencies, no build. All data lives in `localStorage` in your browser.

---

## Deploy from GitHub

### Option A — GitHub Pages (recommended, already configured)

1. Push this folder to a GitHub repository (the default branch must be `main` or `master`).
2. In the repo, go to **Settings → Pages**.
3. Under **Source**, pick **GitHub Actions**.
4. Done. Every push to the default branch publishes automatically via
   `.github/workflows/deploy.yml`. The site URL is shown in **Settings → Pages**.

The repo root **is** the site — `index.html` sits at the top level, and every asset is
referenced with a relative path (`./assets/...`), so it works on a project site
(`https://<user>.github.io/<repo>/`) as well as on a custom domain.

`.nojekyll` is included so GitHub skips Jekyll processing and serves files as-is.

### Option B — any static host

Netlify / Vercel / Cloudflare Pages / Render: point the build command at nothing
(leave it empty) and set the publish directory to the repo root (`.`).

| Host | Build command | Publish directory |
| --- | --- | --- |
| GitHub Pages | *(handled by the workflow)* | `.` |
| Netlify | *(empty)* | `.` |
| Vercel | *(empty)* | `.` |
| Cloudflare Pages | *(empty)* | `.` |

---

## Project structure

```
.
├── index.html                  # the whole app shell (single page)
├── assets/
│   ├── css/styles.css          # design tokens + all styling (light & dark)
│   └── js/
│       ├── data.js             # 56-movie catalog, 5 seeded viewers, genre ids
│       ├── recommender.js      # scoring engine (genre + collaborative + popularity)
│       ├── storage.js          # localStorage wrapper, fails safe to memory
│       └── app.js              # state, rendering, the five menu panels
├── .nojekyll                   # tells GitHub Pages to skip Jekyll
├── .github/workflows/deploy.yml
└── legacy-react/               # the previous React + TypeScript source, kept for reference
```

Scripts load as classic `<script defer>` files (not ES modules), so the site also works
straight off the filesystem.

---

## C → JavaScript mapping

| Original C | This project |
| --- | --- |
| `int scify=0 … int comedy=10` | `CATEGORIES` in `assets/js/data.js` (same ids; 7 = Romance, 11 = Animation added) |
| `struct movie { char moviename[30]; int category; }` | `MOVIES` array |
| `char *users[5]` | `USERS` in `assets/js/data.js` |
| `int ratings[10][5]` (0 = Not Rated, 1–5 = Rating) | `SEED_RATINGS` — same 50 numbers laid out as 5 users × 10 movies |
| `matrix[3][20]` (`id` / `index` / `ratings`) | `RatingRecord { userId, movieId, rating }` + `buildMatrix()` |
| `case 1: Give your review` | Review panel |
| `case 2: Give Your suggestions` (was empty in C) | Suggestions panel — the genre engine |
| `case 3: Top Retings of movies` | Top ratings panel (plus a raw matrix dump, like the C `printf` loop) |
| `case 4: Exit` | Exit panel (resets local data to the seeded dataset) |

Two inconsistencies in the C source had to be reconciled:

1. `ratings[10][5]` is 10 users × 5 movies, but there were 5 users and 10 movies. The
   port keeps all 50 values and lays them out as 5 × 10 (C rows 0–4 → movies 0–4, rows 5–9 → movies 5–9).
2. `matrix[3][20]` caps at 20 reviews. This version stores unlimited ratings in `localStorage`.

The original C source is preserved untouched at `reference/original.c`.

---

## How a suggestion is produced

`assets/js/recommender.js`, score = `0.6 × genre + 0.3 × collaborative + 0.1 × popularity`.

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

A brand-new user sees trending / taste-twin picks with a *"Genre engine locked — rate any
movie 4★ or 5★"* banner. One 5★ on a sci-fi film and the very next render puts Interstellar,
Arrival, Dune, The Matrix and Blade Runner 2049 at the top.

---

## Features

- 56-movie catalog (was 10) so same-genre suggestions have real candidates
- Live match % with a "because you rated X 5★" explanation on every card
- Genre filter chips, movie search, min-ratings filter for the leaderboard
- Taste twins panel, low-rating de-prioritisation, click-to-rate straight from a suggestion
- Add new viewers (cold start handled), edit/remove your own ratings
- "Surprise me" deliberately picks outside your usual genres to avoid an echo chamber
- Raw ratings matrix view — rows are users, columns are movies
- `localStorage` persistence; **Exit** resets to the seeded C dataset
- Light and dark themes, keyboard accessible, responsive down to phone width

---

## Browser support

Any modern browser (Chrome, Edge, Firefox, Safari). Uses `localStorage`, CSS custom
properties and `prefers-color-scheme` — all widely supported. If storage is blocked
(private mode), the app still works and simply does not persist between sessions.
