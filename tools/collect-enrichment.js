/**
 * Filmphile — enrichment collector.
 *
 * Pulls per-title details from free, keyless sources and stores them in
 * server-data/details.json so the running server never needs this much
 * network activity again:
 *
 *   movies  -> Wikipedia (plot extract + director + starring)
 *   series  -> TVmaze episodes (season / episodes-per-season)  [web series]
 *   tv      -> TVmaze episodes via a name search                [broadcast TV]
 *   anime   -> TVmaze episodes via the catalog's show id        [anime]
 *
 * The script is resumable: ids already present in details.json are skipped,
 * so a failed run can simply be re-run.
 *
 * Usage: node tools/collect-enrichment.js [movies|series|tv|anime]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'server-data');
const DETAILS_FILE = path.join(DATA_DIR, 'details.json');
const API_BASE = process.env.API_BASE || 'http://localhost:3000/api';
const UA = 'FilmphileEnrichment/1.0 (enrichment collector; contact: dev@filmphile.local)';

const MAX_SYNOPSIS = 650;
const MAX_LEADS = 3;
const TIMEOUT_MS = 25000;

// ---------------------------------------------------------------------------
// Details store (resumable across runs)
// ---------------------------------------------------------------------------

function defaultDetails() {
  return { movies: {}, series: {}, tv: {}, anime: {}, chart: {} };
}

function loadDetails() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DETAILS_FILE, 'utf8'));
    return {
      movies: parsed.movies || {},
      series: parsed.series || {},
      tv: parsed.tv || {},
      anime: parsed.anime || {},
      chart: parsed.chart || {}
    };
  } catch (e) {
    return defaultDetails();
  }
}

function saveDetails(details) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DETAILS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(details, null, 1));
  fs.renameSync(tmp, DETAILS_FILE);
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function getJson(url, accept) {
  const res = await fetch(url, {
    headers: { accept: accept || 'application/json', 'user-agent': UA }
  });
  if (!res.ok) {
    const err = new Error('HTTP ' + res.status + ' for ' + url);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

/** Run `worker` over `items` with `poolSize` concurrent workers, paced. */
async function runPool(items, poolSize, worker, paceMs) {
  let index = 0;
  let done = 0;
  let failed = 0;

  async function work() {
    while (index < items.length) {
      const item = items[index++];
      const started = Date.now();
      try {
        await worker(item);
      } catch (err) {
        failed++;
        console.warn('  failed', item.id || item.moviename || item, '-', err.message);
      } finally {
        done++;
        if (done % 50 === 0 || done === items.length) {
          console.warn('[progress]', done + '/' + items.length);
        }
        if (paceMs) await sleep(Math.max(0, paceMs - (Date.now() - started)));
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(poolSize, items.length) }, work));
  return { total: items.length, failed };
}

// ---------------------------------------------------------------------------
// Text cleaning helpers
// ---------------------------------------------------------------------------

/** Zap [[Link|label]] and [[Link]] to plain labels. */
function stripWikiLinks(text) {
  return String(text || '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1');
}

/** Remove {{template}} blocks (handles one level of nesting, repeatedly). */
function stripTemplates(text) {
  let out = String(text || '');
  for (let i = 0; i < 10; i++) {
    const next = out.replace(/\{\{[^{}]*\}\}/g, '');
    if (next === out) break;
    out = next;
  }
  return out.replace(/\{\{[^{}]*/g, '');
}

/** Read a single-line infobox field (`| name = value`), stripping markup. */
function infoboxField(wikitext, field) {
  const re = new RegExp('^\\|\\s*' + field + '\\s*=\\s*(.*)$', 'm');
  const m = wikitext.match(re);
  if (!m) return null;
  return cleanInfoboxValue(m[1]);
}

/** Poster file from the infobox `image` field, e.g. `File:Seven Samurai Poster.png`. */
function imageFromInfobox(wikitext) {
  const m = String(wikitext || '').match(/^\|\s*image\s*=\s*(.+)$/m);
  if (!m) return null;
  let value = String(m[1]).trim();
  value = stripTemplates(value).trim();
  const fileRe =
    value.match(/File:([^|\]}]+)/i) ||
    value.match(/([A-Za-z0-9_][\w .\-,()'&+]{2,80}\.(?:png|jpe?g|gif|webp|svg))/i);
  if (!fileRe) return null;
  const file = fileRe[1].replace(/\s+/g, ' ').trim();
  if (file.length < 4 || file.length > 120) return null;
  return 'https://en.wikipedia.org/wiki/Special:FilePath/' +
    encodeURIComponent(file.replace(/ /g, '_')) + '?width=400';
}

const LIST_TEMPLATES = /^\{\{\s*(Plainlist|Ubl|Unbulleted list|flatlist|hlist)/i;

function cleanInfoboxValue(raw) {
  let value = String(raw || '').trim();
  if (!value) return null;

  // Bulleted template: {{Plainlist| * [[Name]] as Role * [[Name]] as Role }}
  if (LIST_TEMPLATES.test(value)) {
    const stripped = value.replace(/<!--[\s\S]*?-->/g, '');
    const bullets = stripped.match(/\n?\*\s*\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g);
    if (bullets && bullets.length) {
      return bullets
        .map(function (b) { return stripWikiLinks(b.replace(/^\s*\*\s*/, '')); })
        .filter(Boolean);
    }
  }

  let clean = stripWikiLinks(stripTemplates(value))
    .replace(/<br\s*\/?>/gi, '|')
    .replace(/\n+/g, '|')
    .replace(/\s*\|\s*/g, '|')
    .replace(/,?\s+and\s+/gi, '|')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ');

  const parts = clean.split('|').map(function (p) { return p.trim(); }).filter(Boolean);
  if (!parts.length) return null;
  return parts;
}

function truncate(text, max) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut) + '\u2026';
}

// ---------------------------------------------------------------------------
// Wikipedia -> movie details
// ---------------------------------------------------------------------------

function wikiSearchUrl(term) {
  const qs = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'search',
    gsrsearch: term,
    gsrlimit: '5',
    prop: 'extracts|revisions',
    exintro: '1',
    explaintext: '1',
    exlimit: '5',
    rvprop: 'content',
    rvslots: 'main',
    redirects: '1'
  });
  return 'https://en.wikipedia.org/w/api.php?' + qs.toString();
}

function normTokens(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/** Relevance: title-token containment drives it; year + film-structure boost. */
function candidateScore(page, movieTitle, year) {
  const movieTokens = normTokens(movieTitle);
  if (!movieTokens.length) return 0;
  const pageTokens = normTokens(page.title);

  let overlap = 0;
  const seen = {};
  movieTokens.forEach(function (t) {
    if (pageTokens.indexOf(t) !== -1 && !seen[t]) { seen[t] = true; overlap++; }
  });
  let score = (overlap / movieTokens.length) * 10;

  const extract = page.extract || '';
  if (year && String(year).length === 4 && extract.indexOf(String(year)) !== -1) score += 3;
  if (/is a \d{4} [^.]+ film\b/.test(extract)) score += 2;
  if (/\(film\)/.test(page.title)) score += 1;
  return score;
}

function pickCandidate(pages, movieTitle, year) {
  let best = null;
  let bestScore = 0;
  (pages || []).forEach(function (page) {
    if (!page || !page.extract) return;
    const score = candidateScore(page, movieTitle, year);
    if (score > bestScore) { best = page; bestScore = score; }
  });
  return bestScore >= 8 ? best : null;
}

/** "…directed by Steven Spielberg from a screenplay…" -> "Steven Spielberg". */
function directorFromText(text) {
  const m = String(text || '').match(
    /(?:written and directed by|directed (?:and|by|\+)\s*(?:co-)?[\w-]+ by|directed by)\s+([A-Z][A-Za-z.'\u2019 -]{2,45}?)(?=\s*(?:,|\.|;| and | from | based on| the | for ))/i
  );
  return m ? m[1].trim() : null;
}

/** "…stars X, Y, and Z." / "stars an ensemble cast, including X" -> [X, Y, ...]. */
function leadsFromText(text) {
  const t = String(text || '').replace(/\s+/g, ' ');
  const skip = /^(a|an|the|and|in|of|with|as|from|at|for)$/i;
  const out = [];

  const m = t.match(/(?:stars|starring)\s+(?:(?:an?\s+)?ensemble\s+(?:cast|crew)\s+(?:including|that\s+includes)\s+|an?\s+ensemble that includes\s+)?([A-Z][A-Za-z.'\u2019-]+(?:\s+[A-Z][A-Za-z.'\u2019-]+)*)(?:\s*,\s*([A-Z][A-Za-z.'\u2019-]+(?:\s+[A-Z][A-Za-z.'\u2019-]+)*))?(?=\s*[,;.)]|\s+and\s+)/);
  if (m && m[1] && !skip.test(m[1])) out.push(m[1].trim());
  if (m && m[2] && !skip.test(m[2])) out.push(m[2].trim());
  if (out.length) return out;

  // "The film follows Bear (Michael Johnston), who…" -> actor in parentheses.
  const m2 = t.match(/(?:follows|centers on|follow the story of)\s+[A-Z][A-Za-z.'\u2019-]+[^()]{0,40}\(([A-Z][A-Za-z.'\u2019 -]+)\)/);
  if (m2 && !skip.test(m2[1])) return [m2[1].trim()];
  return [];
}

/** Search Wikipedia, return the top candidate page + its wikitext (or null). */
async function findWikiPage(movie) {
  const title = movie.moviename;
  const year = movie.year;
  const terms = [
    'intitle:"' + title + '" film',
    'intitle:"' + title + '"',
    '"' + title + '"' + (year ? ' ' + year : '')
  ];

  let doc = null;
  for (let i = 0; i < terms.length && !doc; i++) {
    try {
      doc = await getJson(wikiSearchUrl(terms[i]));
    } catch (e) {
      if (doc === null) doc = null;
    }
  }
  if (!doc || !doc.query || !doc.query.pages) return null;

  const page = pickCandidate(doc.query.pages, title, year);
  if (!page) return null;

  const wikitext = (page.revisions && page.revisions[0] && page.revisions[0].slots.main.content) || '';
  return { page: page, wikitext: wikitext };
}

async function fetchMovieInfo(movie, requireSynopsis) {
  const doc = await findWikiPage(movie);
  if (!doc) return null;
  const page = doc.page;
  const wikitext = doc.wikitext;

  const result = {};
  const synopsis = truncate(page.extract, MAX_SYNOPSIS);
  if (synopsis && synopsis.length >= 25) result.synopsis = synopsis;

  if (wikitext) {
    const image = imageFromInfobox(wikitext);
    if (image) result.image = image;

    const director = infoboxField(wikitext, 'director');
    if (Array.isArray(director) && director.length) result.director = director[0];
    else if (director) result.director = director;

    const starring = infoboxField(wikitext, 'starring');
    const leads = Array.isArray(starring) ? starring : (starring ? [starring] : []);
    if (leads.length) result.leads = leads.slice(0, MAX_LEADS);
  }
  if (!result.director) result.director = directorFromText(page.extract);
  if (!result.leads || !result.leads.length) {
    const fromText = leadsFromText(page.extract);
    if (fromText.length) result.leads = fromText.slice(0, MAX_LEADS);
  }

  if (requireSynopsis && !result.synopsis) return null;
  if (Object.keys(result).length === 0) return null;
  return result;
}

async function fetchMovieFromWikipedia(movie) {
  return fetchMovieInfo(movie, true);
}

// ---------------------------------------------------------------------------
// TVmaze -> seasons / episodes-per-season
// ---------------------------------------------------------------------------

/** Strip "The Complete Series/Collection", "Season N" etc. from feed titles. */
function cleanSeriesTitle(name) {
  return String(name || '')
    .replace(/:\s*(The\s+)?Complete\s+(Original\s+)?(Series|Collection|Set|Boxset).*$/i, '')
    .replace(/,\s*The\s+Complete\s+(Original\s+)?(Series|Collection|Set).*$/i, '')
    .replace(/\s*[-–]\s*The\s+Complete\s+(Original\s+)?(Series|Collection|Set).*$/i, '')
    .replace(/\s*[-–]\s*Season\s+\d+.*$/i, '')
    .replace(/,\s*Season\s+\d+.*$/i, '')
    .replace(/:\s*Season\s+\d+.*$/i, '')
    .replace(/,\s*The\s+Original\s+Series.*$/i, '')
    .replace(/\s*\(\d{4}\)\s*$/, '')
    .replace(/\s+the\s+series\s*$/i, '')
    .trim();
}

function normTitle(t) {
  return String(t || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^the\s+/, '')
    .trim();
}

/** Rank TVmaze candidate shows against the iTunes title; 0 = not a match. */
function tvCandidateScore(movieName, show) {
  const want = normTitle(movieName).split(' ');
  const have = normTitle(show.name).split(' ');
  if (!want.length || want[0].length < 3) return 0;
  const wantTokens = want.filter(function (t) { return t.length > 2; });
  if (!wantTokens.length) return 0;

  if (normTitle(movieName) === normTitle(show.name)) return 1;
  if (have.join(' ').indexOf(normTitle(movieName).replace(/ /g, '')) === 0) return 0.85;

  let hit = 0;
  wantTokens.forEach(function (t) { if (have.indexOf(t) !== -1) hit++; });
  const coverage = hit / wantTokens.length;
  return coverage >= 0.75 ? 0.6 : 0;
}

/** Find the best-matching TVmaze show by name (0.6+ score), or null. */
async function fetchTVShowByName(name) {
  const q = encodeURIComponent(cleanSeriesTitle(name));
  let shows = [];
  try {
    shows = await getJson('https://api.tvmaze.com/search/shows?q=' + q);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
  if (!Array.isArray(shows) || !shows.length) return null;

  let best = null;
  let bestScore = 0;
  shows.forEach(function (c) {
    if (!c || !c.show) return;
    const score = tvCandidateScore(name, c.show);
    if (score > bestScore) { best = c.show; bestScore = score; }
  });
  if (!best || bestScore < 0.6) return null;
  return best;
}

async function fetchTVSeasons(movie) {
  const show = await fetchTVShowByName(movie.moviename);
  if (!show) return null;
  return fetchSeasons(show.id);
}

async function fetchSeasons(tvmazeId) {
  const episodes = await getJson('https://api.tvmaze.com/shows/' + tvmazeId + '/episodes');
  if (!Array.isArray(episodes)) return null;

  const counts = {};
  episodes.forEach(function (ep) {
    const season = Number(ep.season);
    if (season < 1) return; // skip "specials"
    counts[season] = (counts[season] || 0) + 1;
  });

  const seasons = Object.keys(counts)
    .map(Number)
    .sort(function (a, b) { return a - b; })
    .map(function (season) { return { season: season, episodes: counts[season] }; });

  if (!seasons.length) return null;
  return {
    seasons: seasons,
    totalSeasons: seasons.length,
    totalEpisodes: seasons.reduce(function (sum, s) { return sum + s.episodes; }, 0)
  };
}

async function fetchSeriesSeasons(movie) {
  const tvmazeId = String(movie.id).replace(/^web/, '');
  return fetchSeasons(tvmazeId);
}

async function fetchAnimeSeasons(movie) {
  const tvmazeId = String(movie.id).replace(/^anime/, '');
  return fetchSeasons(tvmazeId);
}

async function fetchTVSeasons(movie) {
  const q = encodeURIComponent(cleanSeriesTitle(movie.moviename));
  let show;
  try {
    show = await getJson('https://api.tvmaze.com/singlesearch/shows?q=' + q);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
  return fetchSeasons(show.id);
}

// ---------------------------------------------------------------------------
// Workers
// ---------------------------------------------------------------------------

async function enrichMovie(movie, details) {
  const key = String(movie.id);
  const cached = details.movies[key];
  if (cached && (!process.env.REFILL || (cached.leads && cached.leads.length))) return;
  const info = await fetchMovieFromWikipedia(movie);
  if (info) {
    // When refilling, keep the previous synopsis/director if the new run has none.
    if (cached) {
      info.synopsis = info.synopsis || cached.synopsis;
      info.director = info.director || cached.director;
      info.leads = (info.leads && info.leads.length) ? info.leads : cached.leads || [];
    }
    details.movies[key] = info;
  }
}

async function enrichSeries(movie, details) {
  const key = String(movie.id);
  if (details.series[key]) return;
  const info = await fetchSeriesSeasons(movie);
  if (info) details.series[key] = info;
}

async function enrichAnime(movie, details) {
  const key = String(movie.id);
  if (details.anime[key]) return;
  const info = await fetchAnimeSeasons(movie);
  if (info) details.anime[key] = info;
}

async function enrichTV(movie, details) {
  const key = String(movie.id);
  const cached = details.tv[key];
  if (cached && (!process.env.REFILL || (cached.seasons && cached.seasons.length))) return;
  const info = await fetchTVSeasons(movie);
  if (info && cached) {
    info.seasons = info.seasons && info.seasons.length ? info.seasons : cached.seasons;
    if (info.seasons && info.seasons.length) {
      info.totalSeasons = info.totalSeasons || cached.totalSeasons;
      info.totalEpisodes = info.totalEpisodes || cached.totalEpisodes;
    }
  }
  if (info) details.tv[key] = info;
}

function workerFor(kind, details) {
  if (kind === 'series') return function (item) { return enrichSeries(item, details); };
  if (kind === 'movie' || kind === 'movies') return function (item) { return enrichMovie(item, details); };
  if (kind === 'tv') return function (item) { return enrichTV(item, details); };
  if (kind === 'anime') return function (item) { return enrichAnime(item, details); };
  throw new Error('Unknown kind: ' + kind);
}

// ---------------------------------------------------------------------------
// Chart backfill — poster images (and missed info) for the /api/top rows,
// keyed by the same normalized title the server uses (details.chart).
// ---------------------------------------------------------------------------

async function enrichChartMovie(row, details) {
  const key = normTitle(row.title);
  const existing = details.chart[key] || {};
  if (existing.image) return;
  const info = await fetchMovieInfo({ moviename: row.title, year: row.year }, false);
  if (!info) return;
  details.chart[key] = Object.assign({ title: row.title, year: row.year }, existing, info);
}

async function enrichChartTV(row, details) {
  const key = normTitle(row.title);
  const existing = details.chart[key] || {};
  if (existing.image) return;
  const show = await fetchTVShowByName(row.title);
  if (!show || !show.image) return;
  details.chart[key] = Object.assign({ title: row.title, year: row.year }, existing, {
    image: show.image.original || show.image.medium
  });
}

async function backfillChartPosters(limit) {
  const details = loadDetails();
  const top = await getJson(API_BASE + '/top');
  const movies = limit > 0 ? top.movies.slice(0, limit) : top.movies;
  const shows = limit > 0 ? top.series.concat(top.tv, top.anime).slice(0, limit) : top.series.concat(top.tv, top.anime);

  console.warn('Chart rows used:', movies.length, 'movies /', shows.length, 'series+TV+anime');
  console.warn('Collecting movie chart posters/synopses from Wikipedia...');
  await runPool(movies, 4, function (row) { return enrichChartMovie(row, details); }, 200);
  console.warn('Collecting series/TV/anime chart posters from TVmaze...');
  await runPool(shows, 2, function (row) { return enrichChartTV(row, details); }, 600);

  saveDetails(details);
  return { movies: movies.length, shows: shows.length };
}

function catalogUrl(kind) {
  if (kind === 'series') return API_BASE + '/series';
  if (kind === 'tv') return API_BASE + '/tv';
  if (kind === 'anime') return API_BASE + '/anime';
  return API_BASE + '/movies';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const kind = process.argv[2] || 'movies';

  if (kind === 'backfill') {
    const limitArg = process.argv.indexOf('--limit');
    const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) || 0 : 0;
    console.warn('Backfilling chart poster images (resumable; re-runnable).');
    const start = Date.now();
    const stats = await backfillChartPosters(limit);
    console.warn('Done in', Math.round((Date.now() - start) / 1000) + 's.');
    console.warn('summary:', JSON.stringify(stats));
    return;
  }

  if (['movies', 'movie', 'series', 'tv', 'anime'].indexOf(kind) === -1) {
    console.error('Usage: node tools/collect-enrichment.js [movies|series|tv|anime|backfill] [--limit N]');
    process.exit(1);
  }
  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) || 0 : 0;

  const details = loadDetails();
  let items = await getJson(catalogUrl(kind));
  if (limit > 0) items = items.slice(0, limit);
  const worker = workerFor(kind, details);
  // Wikipedia tolerates brief bursts; TVmaze caps at 20 requests / 10 s.
  const pool = kind === 'movies' ? 4 : 2;
  const pace = kind === 'movies' ? 200 : 600;

  console.warn('Collecting', items.length, 'titles for', kind, '(pool ' + pool + ')');
  const start = Date.now();
  const stats = await runPool(items, pool, worker, pace);
  saveDetails(details);
  console.warn('Done in', Math.round((Date.now() - start) / 1000) + 's.');
  console.warn('summary:', JSON.stringify(stats));
}

main().catch(function (err) {
  console.error('Fatal:', err);
  process.exit(1);
});