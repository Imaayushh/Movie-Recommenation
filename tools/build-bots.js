/**
 * Filmphile — viewer bots + rating seeder.
 *
 * Creates a cast of synthetic viewers ("bots") and gives every title in the
 * catalog (movies, web series, TV shows, anime) a 1–5 star rating from each
 * of them, so the app has realistic community data on day one.
 *
 * How ratings are grounded in reality:
 *   - Titles present in server-data/toplists.json use their REAL IMDb score
 *     (a curated snapshot of the IMDb Top 250 + dedicated anime chart) mapped
 *     onto the 1–5 scale.
 *   - Every other title gets a deterministic "critical consensus" estimate
 *     derived from its own id/title/year (stable across runs), then each bot
 *     perturbs that base by its personality: favourite genres get a lift,
 *     disliked genres get a penalty, plus per-bot noise.
 *
 * Re-runs are idempotent: previous bot users (ids 1000+) and bot ratings are
 * cleared first, so the bot reviews stay byte-for-byte the same every time —
 * for logged-out visitors and every account alike. Human ratings are kept.
 *
 * Environment:  FILMPHILE_SOURCE must be itunes (default). TMDB is unreachable
 * from this network, and IMDb itself blocks server-side scraping, so the IMDb
 * Top-250 snapshot is the honest real-world anchor available here.
 *
 * Usage: node tools/build-bots.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'server-data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');
const TOPLISTS_FILE = path.join(DATA_DIR, 'toplists.json');
const API_BASE = process.env.API_BASE || 'http://localhost:3000/api';

const BOT_BASE_ID = 1000; // far from the C-program viewer ids (1..5) and Aayush's 1

// ---------------------------------------------------------------------------
// Bot personalities
// ---------------------------------------------------------------------------

const BOTS = [
  { name: 'Maya', likes: [0, 2], dislikes: [7, 10], tendency: 0.3, noise: 0.45 },
  { name: 'Ethan', likes: [1, 8, 9], dislikes: [6, 7], tendency: -0.2, noise: 0.35 },
  { name: 'Iris', likes: [3, 5], dislikes: [10, 6], tendency: 0.1, noise: 0.4 },
  { name: 'Omar', likes: [10, 11], dislikes: [6, 4], tendency: 0.3, noise: 0.5 },
  { name: 'Elena', likes: [7, 3], dislikes: [0, 1], tendency: -0.2, noise: 0.4 },
  { name: 'Ravi', likes: [4, 2, 5], dislikes: [11, 7], tendency: 0.0, noise: 0.6 },
  { name: 'Becca', likes: [6, 2], dislikes: [7, 11], tendency: 0.0, noise: 0.45 },
  { name: 'Ken', likes: [], dislikes: [], tendency: 0.2, noise: 0.7 }
];

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) so re-runs reproduce the same data
// ---------------------------------------------------------------------------

function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  return h;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return function () {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Simple djb2-style hash used to anchor each title's "quality". */
function titleHash(id, title, year) {
  return hashString(String(id) + '::' + String(title) + '::' + String(year));
}

// ---------------------------------------------------------------------------
// IMDb Top 250 mapping (real scores -> 1-5)
// ---------------------------------------------------------------------------

function normTitle(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^the\s+/, '')
    .trim();
}

function loadImdbMap() {
  const out = { movies: {}, series: {}, tv: {}, anime: {} };
  try {
    const parsed = JSON.parse(fs.readFileSync(TOPLISTS_FILE, 'utf8'));
    (parsed.imdbMovies || []).forEach(function (row) {
      out.movies[normTitle(row.title) + '|' + row.year] = row.score;
    });
    (parsed.imdbSeries || []).forEach(function (row) {
      out.series[normTitle(row.title) + '|' + row.year] = row.score;
    });
    (parsed.imdbTv || []).forEach(function (row) {
      out.tv[normTitle(row.title) + '|' + row.year] = row.score;
    });
    (parsed.imdbAnime || []).forEach(function (row) {
      out.anime[normTitle(row.title) + '|' + row.year] = row.score;
    });
  } catch (e) {
    /* no toplists -> everything uses the model */
  }
  return out;
}

/** Map a real IMDb score (7..9.5) onto the 1-5 scale. */
function fromImdb(score) {
  if (score >= 9.0) return 5.0;
  if (score >= 8.5) return 4.6;
  if (score >= 8.0) return 4.2;
  if (score >= 7.5) return 3.7;
  if (score >= 7.0) return 3.2;
  return 2.5 + ((score - 6) / 1) * 0.5;
}

/** Deterministic critical-consensus estimate (1-5) for non-listed titles. */
function modelQuality(id, title, category, year) {
  const u = titleHash(id, title, year) / 4294967296; // 0..1
  // Skew towards "decent to good": most catalog titles rate 3-4.5, few 1-2.
  let q = 2.6 + 2.2 * Math.pow(u, 1.5);
  // Genre priors: some categories tend to please audiences more.
  const priors = { 6: -0.25, 7: -0.1, 10: 0.05, 1: 0.1, 9: 0.15, 11: 0.2, 0: 0.2 };
  q += priors[category] || 0;
  if (year && year >= 2000) q += 0.05;
  return Math.max(1, Math.min(5, q));
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function getJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) {
    const err = new Error('HTTP ' + res.status + ' for ' + url);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Fetching catalog from ' + API_BASE + ' ...');
  const [movies, series, tv, anime] = await Promise.all([
    getJson(API_BASE + '/movies'),
    getJson(API_BASE + '/series'),
    getJson(API_BASE + '/tv'),
    getJson(API_BASE + '/anime')
  ]);

  const imdb = loadImdbMap();

  // Build one unified title list with a kind tag.
  const titles = [];
  movies.forEach((m) => titles.push({ kind: 'movies', data: m }));
  series.forEach((s) => titles.push({ kind: 'series', data: s }));
  tv.forEach((t) => titles.push({ kind: 'tv', data: t }));
  anime.forEach((a) => titles.push({ kind: 'anime', data: a }));

  // Pre-compute each title's base quality (real IMDb where available).
  const baseQuality = {};
  titles.forEach(({ kind, data }) => {
    const key = String(data.id);
    const imdbScore = imdb[kind][
      normTitle(data.moviename) + '|' + data.year
    ];
    baseQuality[key] = imdbScore
      ? fromImdb(imdbScore)
      : modelQuality(key, data.moviename, data.category, data.year);
  });

  // Load existing store so we preserve human ratings (Aayush, Alice, ...).
  let store = { nextUserId: 1, users: [], ratings: [], nextRatingId: 1 };
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
    store = {
      nextUserId: parsed.nextUserId || 1,
      users: parsed.users || [],
      ratings: parsed.ratings || [],
      nextRatingId: parsed.nextRatingId || 1
    };
  } catch (e) {
    /* new store */
  }

  // Register bots.
  const bots = BOTS.map((profile, i) => ({
    id: BOT_BASE_ID + i,
    name: profile.name,
    likes: profile.likes,
    dislikes: profile.dislikes,
    tendency: profile.tendency,
    noise: profile.noise
  }));

  // Idempotent reseed: drop previous bot users + bot ratings, then re-add them.
  // The ratings are deterministic, so re-running reproduces the exact same
  // reviews — human ratings are never touched.
  const botIds = new Set(bots.map((b) => b.id));
  const keptUsers = store.users.filter((u) => !botIds.has(u.id));
  const keptRatings = store.ratings.filter((r) => !botIds.has(r.userId));
  store.users = keptUsers.concat(bots.map((b) => ({ id: b.id, name: b.name })));
  store.ratings = keptRatings;
  if (store.nextUserId < BOT_BASE_ID + bots.length) {
    store.nextUserId = BOT_BASE_ID + bots.length;
  }

  // Rate every title once per bot.
  const ratingId = store.nextRatingId || (keptRatings.length + 1);
  let nextId = ratingId;
  const added = [];

  titles.forEach(({ kind, data }, ti) => {
    const key = String(data.id);
    const base = baseQuality[key];
    const catId = data.category;

    bots.forEach((bot) => {
      // Deterministic per (title, bot) noise.
      const rand = mulberry32(titleHash(bot.id + ':' + data.id, data.moviename, data.year));
      const noise = (rand() * 2 - 1) * bot.noise;

      let adjust = bot.tendency;
      if (bot.likes.indexOf(catId) !== -1) adjust += 0.7;
      if (bot.dislikes.indexOf(catId) !== -1) adjust -= 0.7;

      let rating = Math.round(base + adjust + noise);
      rating = Math.max(1, Math.min(5, rating));

      added.push({ id: nextId++, userId: bot.id, movieId: key, rating: rating });
    });
  });

  store.ratings = store.ratings.concat(added);
  store.nextRatingId = nextId;

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = STORE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, STORE_FILE);

  // ---- summary ----
  const hist = {};
  added.forEach((r) => { hist[r.rating] = (hist[r.rating] || 0) + 1; });
  const dist = Object.keys(hist).sort().map((k) => k + '\u2605:' + hist[k]).join('  ');

  console.log('titles:   ' + titles.length + '  (movies ' + movies.length +
    ', series ' + series.length + ', tv ' + tv.length + ', anime ' + anime.length + ')');
  console.log('bots:     ' + bots.map((b) => b.name).join(', '));
  console.log('ratings:  ' + added.length + '  (human ratings preserved: ' + keptRatings.length + ')');
  console.log('distribution (bots only): ' + dist);
  console.log('wrote ' + path.relative(process.cwd(), STORE_FILE));
  console.log('\nRestart the server (npm start) to load the new store.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});