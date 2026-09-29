/**
 * Filmphile — movie catalog server.
 *
 * Default data source is Apple's iTunes Store Top Movies RSS feeds:
 * brand-free, requires NO API key, and works without a VPN (TMDB is
 * blocked on some networks, e.g. India). Set FILMPHILE_SOURCE=tmdb in
 * .env to use TMDB instead (then set TMDB_API_KEY too) — all requests
 * happen here, so any API key never reaches the browser.
 *
 * User profiles and ratings persist to a local JSON file in server-data/.
 */
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// .env loader — keeps keys out of tracked files
// ---------------------------------------------------------------------------

(function loadEnv() {
  try {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) return;
    fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(function (line) {
      const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    });
  } catch (e) { /* non-fatal */ }
})();

const TMDB_API_KEY = process.env.TMDB_API_KEY || process.env.TMDB_READ_TOKEN;
const SOURCE = (process.env.FILMPHILE_SOURCE || 'itunes').toLowerCase();

// Gmail SMTP credentials for the OTP emails. Set these in .env (never commit):
//   GMAIL_USER  — the Gmail address that sends the codes
//   GMAIL_APP_PASSWORD — an App Password created for that account
// Until both are set the server runs in "development mode": the code is logged
// to the console and returned as devOtp in the API response so the flow is
// still testable end-to-end without a real email round-trip.
var GMAIL_USER = process.env.GMAIL_USER || '';
var GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || '';
var MAIL_ENABLED = !!(GMAIL_USER && GMAIL_APP_PASSWORD);
var MAIL_TRANSPORT = null;
if (MAIL_ENABLED) {
  MAIL_TRANSPORT = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD }
  });
}

const TMDB_BASE = 'https://api.themoviedb.org/3/';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

// ---------------------------------------------------------------------------
// Static categories — genre ids preserved 1:1 from the original C program
// ---------------------------------------------------------------------------

var CATEGORIES = [
  { id: 0, key: 'scify', label: 'Sci-Fi' },
  { id: 1, key: 'actionfilm', label: 'Action' },
  { id: 2, key: 'thriller', label: 'Thriller' },
  { id: 3, key: 'drama', label: 'Drama' },
  { id: 4, key: 'crime', label: 'Crime' },
  { id: 5, key: 'biography', label: 'Biography' },
  { id: 6, key: 'horror', label: 'Horror' },
  { id: 7, key: 'romance', label: 'Romance' },
  { id: 8, key: 'adventure', label: 'Adventure' },
  { id: 9, key: 'superhero', label: 'Superhero' },
  { id: 10, key: 'comedy', label: 'Comedy' },
  { id: 11, key: 'animation', label: 'Animation' }
];

/** Compact ISO 639-1 -> English label for the language filter chips. */
var LANGUAGE_NAMES = {
  mr: 'Marathi', en: 'English', hi: 'Hindi', kn: 'Kannada', ko: 'Korean', ja: 'Japanese',
  es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese',
  zh: 'Chinese', ru: 'Russian', ar: 'Arabic', tr: 'Turkish', ta: 'Tamil',
  te: 'Telugu', ml: 'Malayalam', bn: 'Bengali', pa: 'Punjabi',
  gu: 'Gujarati', ur: 'Urdu', id: 'Indonesian', th: 'Thai', vi: 'Vietnamese',
  nl: 'Dutch', sv: 'Swedish', no: 'Norwegian', pl: 'Polish', uk: 'Ukrainian',
  cs: 'Czech', el: 'Greek', he: 'Hebrew', fa: 'Persian', da: 'Danish',
  fi: 'Finnish', hu: 'Hungarian', ro: 'Romanian', sr: 'Serbian', sk: 'Slovak',
  bg: 'Bulgarian', hr: 'Croatian', lt: 'Lithuanian', sl: 'Slovenian', et: 'Estonian',
  lv: 'Latvian', is: 'Icelandic', ka: 'Georgian', hy: 'Armenian', sq: 'Albanian',
  mk: 'Macedonian', ms: 'Malay', tl: 'Filipino', ne: 'Nepali', si: 'Sinhala',
  sw: 'Swahili', lb: 'Luxembourgish', cy: 'Welsh', br: 'Breton', ga: 'Irish'
};

// ---------------------------------------------------------------------------
// Catalog (cached in memory) — populated async at boot or on first request
// ---------------------------------------------------------------------------

var MOVIES = [];
var SERIES = [];
var TV = [];
var ANIME = [];
var LANGUAGES = [];
var ready = null;

function rebuildLanguages() {
  var seen = {};
  var langs = [];
  [MOVIES, SERIES, TV, ANIME].forEach(function (catalog) {
    catalog.forEach(function (m) {
      if (seen[m.language]) return;
      seen[m.language] = true;
      langs.push({ id: m.language, label: LANGUAGE_NAMES[m.language] || m.language });
    });
  });
  langs.sort(function (a, b) { return a.label.localeCompare(b.label); });
  LANGUAGES = langs;
}

// --- iTunes Store loader (default: no key, no VPN needed) -------------------

/** Top Movies RSS feeds — country stores plus per-genre US charts. */
var ITUNES_FEEDS = [
  { region: 'us', url: 'https://itunes.apple.com/us/rss/topmovies/limit=100/json' },
  { region: 'gb', url: 'https://itunes.apple.com/gb/rss/topmovies/limit=100/json' },
  { region: 'in', url: 'https://itunes.apple.com/in/rss/topmovies/limit=100/json' },
  { region: 'jp', url: 'https://itunes.apple.com/jp/rss/topmovies/limit=100/json' },
  { region: 'us', url: 'https://itunes.apple.com/us/rss/topmovies/limit=100/genre=4401/json' }, // Action & Adventure
  { region: 'us', url: 'https://itunes.apple.com/us/rss/topmovies/limit=100/genre=4413/json' }, // Sci-Fi & Fantasy
  { region: 'us', url: 'https://itunes.apple.com/us/rss/topmovies/limit=100/genre=4416/json' }, // Thriller
  { region: 'us', url: 'https://itunes.apple.com/us/rss/topmovies/limit=100/genre=4408/json' }, // Horror
  { region: 'us', url: 'https://itunes.apple.com/us/rss/topmovies/limit=100/genre=4412/json' }, // Romance
  { region: 'us', url: 'https://itunes.apple.com/us/rss/topmovies/limit=100/genre=4404/json' }, // Comedy
  { region: 'us', url: 'https://itunes.apple.com/us/rss/topmovies/limit=100/genre=4405/json' }, // Documentary
  { region: 'us', url: 'https://itunes.apple.com/us/rss/topmovies/limit=100/genre=4410/json' }, // Kids & Family
  { region: 'us', url: 'https://itunes.apple.com/us/rss/topmovies/limit=100/genre=4418/json' }  // Western
];

/** iTunes genre label -> Filmphile category id (ordered, first match wins). */
var ITUNES_GENRE_RULES = [
  [/sci-?fi/i, 0], [/science ?fiction/i, 0],
  [/animation/i, 11], [/anime/i, 11], [/kids/i, 11], [/family/i, 11],
  [/horror/i, 6],
  [/romance/i, 7],
  [/comedy/i, 10],
  [/crime/i, 4],
  [/mystery/i, 2], [/thriller/i, 2],
  [/action/i, 1],
  [/adventure/i, 8], [/fantasy/i, 8], [/western/i, 8],
  [/documentary/i, 5], [/biograph/i, 5], [/histor/i, 5],
  [/musical/i, 3], [/music/i, 3],
  [/drama/i, 3]
];

var REGION_LANGUAGE = { us: 'en', gb: 'en', in: 'hi', jp: 'ja' };

function mapCategoryFromLabel(label) {
  var text = label || '';
  for (var i = 0; i < ITUNES_GENRE_RULES.length; i++) {
    if (ITUNES_GENRE_RULES[i][0].test(text)) return ITUNES_GENRE_RULES[i][1];
  }
  return 3; // Drama as a neutral fallback
}

/** iTunes artwork URLs are thumbnails — request a bigger one. */
function upsizeArt(url) {
  return String(url || '').replace(/\/\d+x\d+bb\.png$/, '/600x900bb.png');
}

function transformItunes(entry, region, prefix) {
  var name = (entry['im:name'] || {}).label || '';
  var attrs = (entry.id || {}).attributes || {};
  var id = attrs['im:id'] || null;
  var dateLabel = ((entry['im:releaseDate'] || {}).label) || '';
  var year = /^(\d{4})/.test(dateLabel) ? Number(dateLabel.slice(0, 4)) : null;
  var images = entry['im:image'] || [];
  var art = images.length ? images[images.length - 1].label : '';
  var genreLabel = (((entry.category || {}).attributes || {}).label) || '';

  if (!id || !name) return null;
  return {
    id: (prefix || '') + Number(id),
    moviename: name,
    category: mapCategoryFromLabel(genreLabel),
    year: year,
    language: REGION_LANGUAGE[region] || 'en',
    poster_url: art ? upsizeArt(art) : null,
    tmdbRating: 0
  };
}

async function fetchItunesFeeds(feedList) {
  return Promise.all(feedList.map(function (feed) {
    return fetch(feed.url, { headers: { accept: 'application/json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('iTunes HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) { return { data: data, region: feed.region }; })
      .catch(function (err) {
        console.error('iTunes feed failed:', feed.url, err.message);
        return { data: null, region: feed.region };
      });
  }));
}

async function loadCatalogItunes() {
  var feeds = await fetchItunesFeeds(ITUNES_FEEDS);

  var seen = new Map();
  feeds.forEach(function (feed) {
    if (!feed.data || !feed.data.feed) return;
    (feed.data.feed.entry || []).forEach(function (entry) {
      var movie = transformItunes(entry, feed.region);
      if (movie && !seen.has(movie.id)) seen.set(movie.id, movie);
    });
  });

  MOVIES = Array.from(seen.values());
  return { movieCount: MOVIES.length };
}

// --- TV Shows (iTunes Top TV Seasons feeds) + Web Series (TVmaze) -----------

var ITUNES_TV_FEEDS = [
  { region: 'us', url: 'https://itunes.apple.com/us/rss/toptvseasons/limit=100/json' },
  { region: 'gb', url: 'https://itunes.apple.com/gb/rss/toptvseasons/limit=100/json' },
  { region: 'in', url: 'https://itunes.apple.com/in/rss/toptvseasons/limit=100/json' },
  { region: 'jp', url: 'https://itunes.apple.com/jp/rss/toptvseasons/limit=100/json' },
  { region: 'ca', url: 'https://itunes.apple.com/ca/rss/toptvseasons/limit=100/json' },
  { region: 'au', url: 'https://itunes.apple.com/au/rss/toptvseasons/limit=100/json' }
];

async function loadTVShowsItunes() {
  var feeds = await fetchItunesFeeds(ITUNES_TV_FEEDS);
  var seen = new Map();
  feeds.forEach(function (feed) {
    if (!feed.data || !feed.data.feed) return;
    (feed.data.feed.entry || []).forEach(function (entry) {
      var show = transformItunes(entry, feed.region, 'tv');
      if (show && !seen.has(show.id)) seen.set(show.id, show);
    });
  });
  TV = Array.from(seen.values());
  return { tvCount: TV.length };
}

/** TVmaze language is a name like "English" / "Japanese" — map to ISO codes. */
var LANGUAGE_NAME_TO_CODE = {
  english: 'en', hindi: 'hi', kannada: 'kn', korean: 'ko', japanese: 'ja',
  spanish: 'es', french: 'fr', german: 'de', italian: 'it', portuguese: 'pt',
  chinese: 'zh', cantonese: 'zh', mandarin: 'zh', russian: 'ru', arabic: 'ar',
  turkish: 'tr', tamil: 'ta', telugu: 'te', malayalam: 'ml', bengali: 'bn',
  punjabi: 'pa', marathi: 'mr', gujarati: 'gu', urdu: 'ur', indonesian: 'id',
  thai: 'th', vietnamese: 'vi', dutch: 'nl', swedish: 'sv', norwegian: 'no',
  polish: 'pl', ukrainian: 'uk', czech: 'cs', slovak: 'sk', greek: 'el',
  hebrew: 'he', danish: 'da', finnish: 'fi', hungarian: 'hu', romanian: 'ro',
  serbian: 'sr', croatian: 'hr', tagalog: 'tl', filipino: 'tl', malay: 'ms',
  nepali: 'ne', swahili: 'sw', persian: 'fa', afrikaans: 'af'
};

function mapLanguageName(name) {
  var key = String(name || '').toLowerCase().trim();
  return LANGUAGE_NAME_TO_CODE[key] || key || 'en';
}

/**
 * Web Series + Anime: both come from the same paged TVmaze /shows scan.
 *   - Web Series: shows streamed on a web channel only (Netflix, Prime, ...).
 *   - Anime: shows whose genre list includes "Anime" (posters + synopses).
 * The /shows list is paged ~240 per page; we scan a bounded prefix once and
 * build both catalogs from it, so no extra network calls are needed.
 */
var TVMAZE_SHOWS_PAGES = 10;

/** Loose HTML -> plain text (TVmaze summaries are HTML snippets). */
function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

async function loadWebSeriesAndAnimeTVmaze() {
  var pageUrls = [];
  for (var p = 0; p < TVMAZE_SHOWS_PAGES; p++) pageUrls.push('https://api.tvmaze.com/shows?page=' + p);

  var batches = await Promise.all(pageUrls.map(function (url) {
    return fetch(url, { headers: { accept: 'application/json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('TVmaze HTTP ' + res.status);
        return res.json();
      })
      .catch(function (err) {
        console.error('TVmaze page failed:', url, err.message);
        return [];
      });
  }));

  var seriesSeen = new Map();
  var animeSeen = new Map();

  batches.forEach(function (list) {
    if (!Array.isArray(list)) return;
    list.forEach(function (s) {
      if (!s || !s.id || !s.name) return;
      var genreLabel = (s.genres || []).join(' ');
      var year = s.premiered ? Number(String(s.premiered).slice(0, 4)) : null;

      if (s.webChannel && !seriesSeen.has('web' + s.id)) {
        var id = 'web' + s.id;
        seriesSeen.set(id, {
          id: id,
          moviename: s.name,
          category: mapCategoryFromLabel(genreLabel),
          year: year,
          language: mapLanguageName(s.language),
          poster_url: s.image && s.image.medium ? s.image.medium : null,
          tmdbRating: 0
        });
      }

      if ((s.genres || []).indexOf('Anime') !== -1 && !animeSeen.has('anime' + s.id)) {
        var aid = 'anime' + s.id;
        var row = {
          id: aid,
          moviename: s.name,
          category: mapCategoryFromLabel(genreLabel),
          year: year,
          language: mapLanguageName(s.language),
          poster_url: s.image && s.image.medium ? s.image.medium : null,
          tmdbRating: 0
        };
        var synopsis = stripHtml(s.summary);
        if (synopsis && synopsis.length >= 30) row.synopsis = synopsis;
        animeSeen.set(aid, row);
      }
    });
  });

  SERIES = Array.from(seriesSeen.values());
  ANIME = Array.from(animeSeen.values());
  return { seriesCount: SERIES.length, animeCount: ANIME.length };
}

// --- TMDB loader (optional: needs FILMPHILE_SOURCE=tmdb + a reachable network)

/** TMDB genre id -> Filmphile category id (first match in priority order wins). */
var GENRE_PRIORITY = [
  [878, 0],      // Science Fiction -> Sci-Fi
  [53, 2],       // Thriller -> Thriller
  [27, 6],       // Horror -> Horror
  [10749, 7],    // Romance -> Romance
  [16, 11],      // Animation -> Animation
  [35, 10],      // Comedy -> Comedy
  [80, 4],       // Crime -> Crime
  [18, 3],       // Drama -> Drama
  [28, 1],       // Action -> Action
  [12, 8],       // Adventure -> Adventure
  [14, 8],       // Fantasy -> Adventure
  [37, 8],       // Western -> Adventure
  [99, 5],       // Documentary -> Biography
  [36, 5],       // History -> Biography
  [10402, 5],    // Music -> Biography
  [9648, 2],     // Mystery -> Thriller
  [10752, 3],    // War -> Drama
  [10751, 11],   // Family -> Animation
  [10770, 3]     // TV Movie -> Drama
];

function tmdbGet(endpoint, params) {
  if (!TMDB_API_KEY) {
    var err = new Error('TMDB_API_KEY is not set. Copy .env.example to .env and add your key.');
    err.status = 500;
    return Promise.reject(err);
  }
  var qs = new URLSearchParams({ api_key: TMDB_API_KEY, language: 'en-US' });
  Object.keys(params || {}).forEach(function (k) { qs.set(k, params[k]); });
  return fetch(TMDB_BASE + endpoint + '?' + qs.toString(), {
    headers: { accept: 'application/json' }
  }).then(function (res) {
    if (!res.ok) {
      return res.text().then(function (text) {
        var err = new Error('TMDB ' + res.status + ': ' + text.slice(0, 200));
        err.status = res.status;
        throw err;
      });
    }
    return res.json();
  });
}

async function fetchTMDBList(endpoint, maxPages) {
  var collected = [];
  for (var page = 1; page <= maxPages; page++) {
    var data = await tmdbGet(endpoint, { page: page });
    var results = data.results || [];
    collected.push.apply(collected, results);
    if (page >= (data.total_pages || 0)) break;
  }
  return collected;
}

function mapCategory(genreIds) {
  var ids = genreIds || [];
  for (var i = 0; i < GENRE_PRIORITY.length; i++) {
    if (ids.indexOf(GENRE_PRIORITY[i][0]) !== -1) return GENRE_PRIORITY[i][1];
  }
  return 3;
}

function transformTMDB(t) {
  var year = t.release_date ? Number(String(t.release_date).slice(0, 4)) : null;
  return {
    id: t.id,
    moviename: t.title || t.name || t.original_title || t.original_name,
    category: mapCategory(t.genre_ids),
    year: year,
    language: t.original_language || 'en',
    poster_url: t.poster_path ? TMDB_IMAGE_BASE + t.poster_path : null,
    tmdbRating: t.vote_average || 0
  };
}

async function loadCatalogTMDB() {
  var lists = await Promise.all([
    fetchTMDBList('movie/popular', 10),
    fetchTMDBList('movie/top_rated', 10),
    fetchTMDBList('movie/now_playing', 5),
    fetchTMDBList('movie/upcoming', 3),
    fetchTMDBList('trending/movie/week', 6),
    fetchTMDBList('trending/movie/day', 3)
  ]);

  var seen = new Map();
  lists.forEach(function (batch) {
    batch.forEach(function (t) {
      if (t && t.id && (t.title || t.name) && !seen.has(t.id)) {
        seen.set(t.id, transformTMDB(t));
      }
    });
  });

  MOVIES = Array.from(seen.values());
  MOVIES.sort(function (a, b) { return (b.tmdbRating || 0) - (a.tmdbRating || 0); });
  rebuildLanguages();
  return { movieCount: MOVIES.length };
}

function loadCatalog() {
  if (SOURCE === 'tmdb') {
    return loadCatalogTMDB().then(function (result) {
      mergeEnrichment();
      return result;
    });
  }
  return Promise.all([
    loadCatalogItunes(),
    loadTVShowsItunes()
  ]).then(function () {
    return loadWebSeriesAndAnimeTVmaze();
  }).then(function () {
    rebuildLanguages();
    mergeEnrichment();
    return { movieCount: MOVIES.length, seriesCount: SERIES.length, tvCount: TV.length, animeCount: ANIME.length };
  });
}

// ---------------------------------------------------------------------------
// Persistence — users + ratings in a local JSON file (no database required)
// ---------------------------------------------------------------------------

var DATA_DIR = path.join(__dirname, 'server-data');
var STORE_FILE = path.join(DATA_DIR, 'store.json');

function defaultStore() {
  return { nextUserId: 1, users: [], ratings: [], nextRatingId: 1 };
}

function loadStore() {
  try {
    var parsed = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
    return {
      nextUserId: parsed.nextUserId,
      users: parsed.users || [],
      ratings: parsed.ratings || [],
      nextRatingId: parsed.nextRatingId || 1
    };
  } catch (e) {
    return defaultStore();
  }
}

function saveStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

var store = loadStore();

// ---------------------------------------------------------------------------
// Email verification (OTP) — accounts are created only after the user proves
// they own the email they typed. Codes are short-lived (5 min), single-use,
// stored hashed in memory (never written to disk), and each email can claim
// one account — so a verified email can never be reused by anyone else.
// ---------------------------------------------------------------------------

var OTP_LIFETIME_MS = 5 * 60 * 1000;   // a code expires after 5 minutes
var OTP_COOLDOWN_MS = 30 * 1000;       // resend window between codes
var OTP_MAX_ATTEMPTS = 5;              // wrong tries before a code is voided

var otps = new Map(); // email (lowercased) -> { name, mode, hash, expiresAt, attempts, sentAt }

var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(value) {
  return EMAIL_RE.test(normalizeEmail(value));
}

function hashOtp(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

function generateOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function findUserByEmail(email) {
  var key = normalizeEmail(email);
  return store.users.find(function (u) { return String(u.email || '').toLowerCase() === key; });
}

function emailInUse(email) {
  return !!findUserByEmail(email);
}

function clearOtp(email) {
  otps.delete(normalizeEmail(email));
}

/** Send the code by email, or log it when Gmail is not configured yet. */
function deliverOtp(to, code) {
  if (!MAIL_ENABLED) {
    console.log('[auth] OTP for ' + to + ': ' + code +
      ' (set GMAIL_USER/GMAIL_APP_PASSWORD in .env to send real emails)');
    return Promise.resolve(true);
  }
  var html =
    '<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;border:1px solid #e5e5e5;border-radius:14px">' +
    '<h2 style="margin:0 0 8px;font-size:20px">Filmphile verification code</h2>' +
    '<p style="font-size:14px;line-height:1.5;color:#444">Use this code to finish ' +
    '<strong>signing in</strong>. It expires in 5 minutes.</p>' +
    '<div style="font-size:30px;font-weight:700;letter-spacing:8px;color:#000;background:#f5f5f7;border-radius:10px;padding:14px;text-align:center">' + code + '</div>' +
    '<p style="font-size:12px;color:#888;margin-top:16px">If you did not request this, you can safely ignore this email.</p>' +
    '</div>';
  return MAIL_TRANSPORT.sendMail({
    from: '"Filmphile" <' + GMAIL_USER + '>',
    to: to,
    subject: 'Your Filmphile verification code',
    text: 'Your Filmphile verification code is ' + code + '. It expires in 5 minutes. If you did not request this, you can safely ignore this email.',
    html: html
  }).then(function () { return true; });
}

// ---------------------------------------------------------------------------
// Top-rated lists — curated IMDb snapshot (movies + TV), matched to the catalog
// ---------------------------------------------------------------------------

var TOPLISTS_FILE = path.join(DATA_DIR, 'toplists.json');

function readToplists() {
  try {
    var parsed = JSON.parse(fs.readFileSync(TOPLISTS_FILE, 'utf8'));
    return {
      imdbMovies: parsed.imdbMovies || [],
      imdbSeries: parsed.imdbSeries || [],
      imdbTv: parsed.imdbTv || [],
      imdbAnime: parsed.imdbAnime || []
    };
  } catch (e) {
    return { imdbMovies: [], imdbSeries: [], imdbTv: [], imdbAnime: [] };
  }
}

var toplists = readToplists();

// ---------------------------------------------------------------------------
// Content similarity — precomputed by tools/build-recs.py (Python scikit-learn)
// ---------------------------------------------------------------------------

var SIMILARITY_FILE = path.join(DATA_DIR, 'similarity.json');

function readSimilarity() {
  try {
    var parsed = JSON.parse(fs.readFileSync(SIMILARITY_FILE, 'utf8'));
    return {
      movies: parsed.movies || {},
      series: parsed.series || {},
      tv: parsed.tv || {}
    };
  } catch (e) {
    return { movies: {}, series: {}, tv: {} };
  }
}

var similarity = readSimilarity();

// ---------------------------------------------------------------------------
// Enrichment — per-title details fetched once by tools/collect-enrichment.js
// (Wikipedia synopsis/director/leads for movies, TVmaze seasons/episodes for
// series and TV). Loaded at boot and merged as NEW fields only, so the
// original catalog fields survive untouched.
// ---------------------------------------------------------------------------

var DETAILS_FILE = path.join(DATA_DIR, 'details.json');

function readEnrichment() {
  try {
    return JSON.parse(fs.readFileSync(DETAILS_FILE, 'utf8'));
  } catch (e) {
    return {};
  }
}

function applyEnrichment(catalog, map) {
  if (!map || !Array.isArray(catalog)) return;
  catalog.forEach(function (item) {
    var extra = map[String(item.id)];
    if (!extra) return;
    Object.keys(extra).forEach(function (key) {
      if (item[key] === undefined) item[key] = extra[key];
    });
  });
}

/** Chart enrichment (poster/images, synopses) keyed by normalized title. */
var chartEnrichment = {};

function mergeEnrichment() {
  var details = readEnrichment();
  applyEnrichment(MOVIES, details.movies);
  applyEnrichment(SERIES, details.series);
  applyEnrichment(TV, details.tv);
  applyEnrichment(ANIME, details.anime);
  chartEnrichment = details.chart || {};
}

/** Normalise a title for loose matching (lowercase, punctuation-stripped, no leading "The"). */
function normTitle(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^the\s+/, '')
    .trim();
}

function findInCatalog(catalog, title) {
  var key = normTitle(title);
  for (var i = 0; i < catalog.length; i++) {
    if (normTitle(catalog[i].moviename) === key) return catalog[i];
  }
  return null;
}

/** Average star rating from all viewers for a catalog item (0 when unrated). */
function communityAverage(movieId) {
  if (movieId === null || movieId === undefined) return 0;
  var sum = 0, count = 0;
  store.ratings.forEach(function (r) {
    if (String(r.movieId) === String(movieId) && r.rating > 0) { sum += r.rating; count++; }
  });
  return count > 0 ? +(sum / count).toFixed(1) : 0;
}

// ---------------------------------------------------------------------------
// Today's pick — a featured title that rotates once per day. The primary
// source is server-data/daily-pick.json written by tools/daily-pick.py (Python,
// running on top of the scikit-learn similarity model). The in-server fallback
// below mirrors that logic so the feature works even without the Python side.
// ---------------------------------------------------------------------------

/** Stable string hash (FNV-1a) for deterministic daily rotation. */
function stableHash(str) {
  var h = 2166136261;
  for (var i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function todayKey() {
  var d = new Date();
  var mm = String(d.getMonth() + 1).padStart(2, '0');
  var dd = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + mm + '-' + dd;
}

function findCatalogItemById(id) {
  var key = String(id);
  var shapes = [
    { kind: 'movie', list: MOVIES },
    { kind: 'series', list: SERIES },
    { kind: 'tv', list: TV },
    { kind: 'anime', list: ANIME }
  ];
  for (var i = 0; i < shapes.length; i++) {
    for (var j = 0; j < shapes[i].list.length; j++) {
      if (String(shapes[i].list[j].id) === key) {
        return { kind: shapes[i].kind, item: shapes[i].list[j] };
      }
    }
  }
  return null;
}

/** Daily-pick spec + catalog merge: community avg, poster, synopsis, leads... */
function buildDailyPickRow(spec) {
  if (!spec || spec.catalogId === null || spec.catalogId === undefined) return null;
  var found = findCatalogItemById(spec.catalogId);
  if (!found) return null;
  var cat = found.item;
  var ratingCount = 0, sum = 0;
  store.ratings.forEach(function (r) {
    if (String(r.movieId) === String(cat.id) && r.rating > 0) { sum += r.rating; ratingCount++; }
  });
  var meta = {
    date: spec.date,
    kind: found.kind,
    catalogId: cat.id,
    title: cat.moviename,
    year: cat.year,
    category: cat.category,
    language: cat.language,
    communityAvg: communityAverage(cat.id),
    ratingCount: ratingCount,
    poster: cat.poster_url || null,
    synopsis: cat.synopsis || null,
    director: cat.director || null,
    leads: (cat.leads && cat.leads.length) ? cat.leads : null,
    imdbScore: spec.imdbScore != null ? spec.imdbScore : null,
    reason: spec.reason || null
  };
  if (cat.seasons) {
    meta.seasons = cat.seasons;
    meta.totalSeasons = cat.totalSeasons != null ? cat.totalSeasons : cat.seasons.length;
    meta.totalEpisodes = cat.totalEpisodes != null
      ? cat.totalEpisodes
      : cat.seasons.reduce(function (s, e) { return s + e.episodes; }, 0);
  }
  return meta;
}

/** Deterministic fallback (mirrors tools/daily-pick.py) when Python file is absent. */
function computeDailyPickFallback() {
  var dateKey = todayKey();
  var ranked = [];
  function walk(kind, list) {
    list.forEach(function (item) {
      var count = 0, sum = 0;
      store.ratings.forEach(function (r) {
        if (String(r.movieId) === String(item.id) && r.rating > 0) { sum += r.rating; count++; }
      });
      if (count < 4 || sum / count < 3.0) return;
      var simBucket = similarity && similarity[kind] ? similarity[kind] : {};
      var reach = (simBucket[String(item.id)] || []).length;
      if (reach < 2) return;
      var popularity = Math.min(count, 50) / 50;
      var score = (sum / count) * 10 + popularity * 5 + Math.min(reach, 10) * 0.4;
      ranked.push({ score: score, count: count, spec: { date: dateKey, kind: kind, catalogId: item.id } });
    });
  }
  walk('movie', MOVIES);
  walk('series', SERIES);
  walk('tv', TV);
  walk('anime', ANIME);
  ranked.sort(function (a, b) { return (b.score - a.score) || (b.count - a.count); });
  if (ranked.length === 0) return null;
  var top = ranked.slice(0, 60);
  var spec = top[stableHash(dateKey) % top.length].spec;
  return buildDailyPickRow(spec);
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(cors());
app.use(express.json());
app.use(function (req, res, next) {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(express.static(path.join(__dirname)));

function ensureReady(req, res, next) {
  if (!ready) ready = loadCatalog();
  ready.then(function () { next(); }).catch(function (err) {
    res.status(err.status || 500).json({ error: err.message });
  });
}

// ---------------------------------------------------------------------------
// API routes — same surface as before so the frontend keeps working
// ---------------------------------------------------------------------------

app.get('/api/categories', function (req, res) { res.json(CATEGORIES); });

app.get('/api/languages', ensureReady, function (req, res) { res.json(LANGUAGES); });

app.get('/api/movies', ensureReady, function (req, res) { res.json(MOVIES); });

app.get('/api/movies/:id', ensureReady, function (req, res) {
  var movie = MOVIES.find(function (m) { return String(m.id) === String(req.params.id); });
  if (!movie) return res.status(404).json({ error: 'Movie not found' });
  res.json(movie);
});

app.get('/api/similarity', function (req, res) { res.json(similarity); });

app.get('/api/daily-pick', ensureReady, function (req, res) {
  var row = null;
  try {
    var parsed = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'daily-pick.json'), 'utf8'));
    if (parsed && parsed.date === todayKey()) row = buildDailyPickRow(parsed);
  } catch (e) { /* no python pick yet — use the fallback */ }
  if (!row) row = computeDailyPickFallback();
  res.json(row);
});

app.get('/api/series', ensureReady, function (req, res) { res.json(SERIES); });

app.get('/api/tv', ensureReady, function (req, res) { res.json(TV); });

app.get('/api/anime', ensureReady, function (req, res) { res.json(ANIME); });

app.get('/api/top', ensureReady, function (req, res) {
  var MAX = 100;

  /** Catalog + enrichment summary for a matched item (null-safe). */
  function catalogMeta(cat) {
    if (!cat) {
      return {
        catalogId: null, category: null, language: null, communityAvg: 0,
        poster: null, synopsis: null, director: null, leads: null,
        seasons: null, totalSeasons: null, totalEpisodes: null
      };
    }
    var meta = {
      catalogId: cat.id,
      category: cat.category,
      language: cat.language,
      communityAvg: communityAverage(cat.id),
      poster: cat.poster_url || null,
      synopsis: cat.synopsis || null,
      director: cat.director || null,
      leads: (cat.leads && cat.leads.length) ? cat.leads : null
    };
    if (cat.seasons) {
      meta.seasons = cat.seasons;
      meta.totalSeasons = cat.totalSeasons != null
        ? cat.totalSeasons
        : cat.seasons.length;
      meta.totalEpisodes = cat.totalEpisodes != null
        ? cat.totalEpisodes
        : cat.seasons.reduce(function (sum, s) { return sum + s.episodes; }, 0);
    }
    return meta;
  }

  /** Fill any missing info on a chart row from the chart enrichment (poster/images). */
  function attachChartInfo(entry) {
    var info = chartEnrichment && chartEnrichment[normTitle(entry.title)];
    if (!info) return;
    if (!entry.poster && info.image) entry.poster = info.image;
    if (!entry.synopsis && info.synopsis) entry.synopsis = info.synopsis;
    if (!entry.director && info.director) entry.director = info.director;
    if (!entry.leads && info.leads && info.leads.length) entry.leads = info.leads;
  }

  /** Merge the IMDb movie chart into one list, keeping only the IMDb score. */
  function buildMovieChart(imdbRows) {
    var out = imdbRows.slice(0, MAX).map(function (item) {
      var meta = catalogMeta(findInCatalog(MOVIES, item.title));
      var entry = {
        title: item.title,
        year: item.year,
        imdbScore: item.score
      };
      Object.keys(meta).forEach(function (k) { entry[k] = meta[k]; });
      attachChartInfo(entry);
      return entry;
    });
    out.sort(byScore);
    return out;
  }

  function byScore(a, b) { return (b.imdbScore || 0) - (a.imdbScore || 0); }

  /**
   * Build one ranked row for the web-series / TV charts. Curated IMDb rows are
   * enriched from the live catalog when a title matches, and from the offline
   * chart store otherwise — so every row renders with a genre, a poster (or a
   * letter-tile fallback) and its IMDb score.
   */
  function buildSeriesTvRow(item, tab) {
    var cat;
    if (tab === 'anime') {
      cat = findInCatalog(ANIME, item.title) ||
        findInCatalog(TV, item.title) ||
        findInCatalog(MOVIES, item.title) ||
        findInCatalog(SERIES, item.title);
    } else if (tab === 'series') {
      cat = findInCatalog(SERIES, item.title) || findInCatalog(TV, item.title);
    } else {
      cat = findInCatalog(TV, item.title) || findInCatalog(SERIES, item.title);
    }
    var meta = catalogMeta(cat);
    var entry = {
      title: item.title,
      year: item.year,
      imdbScore: item.score,
      category: item.category != null ? item.category : meta.category,
      poster: meta.poster,
      language: meta.language,
      communityAvg: meta.communityAvg,
      synopsis: meta.synopsis,
      director: meta.director,
      leads: meta.leads,
      seasons: meta.seasons,
      totalSeasons: meta.totalSeasons,
      totalEpisodes: meta.totalEpisodes,
      catalogId: meta.catalogId,
      platform: item.platform || null,
      network: item.network || null
    };
    attachChartInfo(entry);
    return entry;
  }

  var series = toplists.imdbSeries.slice(0, MAX).map(function (item) {
    return buildSeriesTvRow(item, 'series');
  });
  var tv = toplists.imdbTv.slice(0, MAX).map(function (item) {
    return buildSeriesTvRow(item, 'tv');
  });
  var anime = toplists.imdbAnime.slice(0, MAX).map(function (item) {
    return buildSeriesTvRow(item, 'anime');
  });
  series.sort(byScore);
  tv.sort(byScore);
  anime.sort(byScore);

  res.json({
    movies: buildMovieChart(toplists.imdbMovies.slice(0, MAX)),
    series: series,
    tv: tv,
    anime: anime
  });
});

app.get('/api/users', function (req, res) { res.json(store.users); });

app.post('/api/users', function (req, res) {
  var name = (req.body && req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name is required' });
  var user = { id: store.nextUserId++, name: name };
  store.users.push(user);
  saveStore();
  res.status(201).json(user);
});

// --- Email OTP auth ---------------------------------------------------------

/**
 * Send a verification code to an email address.
 *   body: { email, name?, mode: 'register' | 'login' }
 *   mode 'register': email must be free; a username is required.
 *   mode 'login':    email must belong to an existing account.
 * Responds with devOtp (development only) plus cooldown/expiry metadata.
 */
app.post('/api/auth/send-otp', function (req, res) {
  var mode = req.body && req.body.mode === 'login' ? 'login' : 'register';
  var email = normalizeEmail(req.body && req.body.email);
  var name = mode === 'register' ? String((req.body && req.body.name) || '').trim() : '';

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (mode === 'register') {
    if (name.length < 2) return res.status(400).json({ error: 'Username must be at least 2 characters long.' });
    if (name.length > 40) return res.status(400).json({ error: 'Username must be under 40 characters.' });
    if (emailInUse(email)) {
      return res.status(409).json({ error: 'This email is already registered. Log in instead.' });
    }
  } else {
    if (!emailInUse(email)) {
      return res.status(404).json({ error: 'No account uses this email. Create an account first.' });
    }
  }

  var prior = otps.get(email);
  var waitMs = prior ? OTP_COOLDOWN_MS - (Date.now() - prior.sentAt) : 0;
  if (waitMs > 0) {
    return res.status(429).json({
      error: 'A code was just sent. Wait ' + Math.ceil(waitMs / 1000) + 's before requesting another.',
      retryAfter: Math.ceil(waitMs / 1000)
    });
  }

  var code = generateOtp();
  otps.set(email, {
    name: name,
    mode: mode,
    hash: hashOtp(code),
    expiresAt: Date.now() + OTP_LIFETIME_MS,
    attempts: 0,
    sentAt: Date.now()
  });

  return deliverOtp(email, code).then(function () {
    res.json({
      success: true,
      message: 'A 6-digit code was ' + (MAIL_ENABLED ? 'sent to ' + email : 'generated') + '.',
      devOtp: MAIL_ENABLED ? null : code,
      expiresIn: Math.floor(OTP_LIFETIME_MS / 1000),
      cooldown: Math.floor(OTP_COOLDOWN_MS / 1000)
    });
  }).catch(function (err) {
    otps.delete(email);
    console.error('[auth] email send failed:', err.message);
    res.status(502).json({ error: 'Could not send the email right now. Try again in a moment.' });
  });
});

/**
 * Confirm a code and finish the action (create the account or log in).
 *   body: { email, otp, name?, mode: 'register' | 'login' }
 * On success returns { user, isNewUser } — the user is persisted for registers.
 */
app.post('/api/auth/verify-otp', function (req, res) {
  var mode = req.body && req.body.mode === 'login' ? 'login' : 'register';
  var email = normalizeEmail(req.body && req.body.email);
  var code = String((req.body && req.body.otp) || '').replace(/\s+/g, '');
  var name = mode === 'register' ? String((req.body && req.body.name) || '').trim() : '';

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'Enter the 6-digit code.' });
  }

  var rec = otps.get(email);
  if (!rec || rec.mode !== mode) {
    return res.status(400).json({ error: 'No code was requested for this email.' });
  }
  if (Date.now() > rec.expiresAt) {
    clearOtp(email);
    return res.status(400).json({ error: 'This code has expired. Request a new one.' });
  }
  if (rec.attempts >= OTP_MAX_ATTEMPTS) {
    clearOtp(email);
    return res.status(429).json({ error: 'Too many incorrect attempts. Request a new code.' });
  }
  if (rec.hash !== hashOtp(code)) {
    rec.attempts += 1;
    var left = OTP_MAX_ATTEMPTS - rec.attempts;
    return res.status(400).json({ error: left > 0
      ? 'Incorrect code — ' + left + ' attempt' + (left === 1 ? '' : 's') + ' left.'
      : 'Too many incorrect attempts. Request a new code.' });
  }
  clearOtp(email);

  if (mode === 'login') {
    var existing = findUserByEmail(email);
    if (!existing) return res.status(404).json({ error: 'No account uses this email.' });
    return res.json({ success: true, user: existing, isNewUser: false });
  }

  if (name.length < 2) return res.status(400).json({ error: 'Username must be at least 2 characters long.' });
  if (emailInUse(email)) {
    return res.status(409).json({ error: 'This email was just registered by someone else.' });
  }
  var fresh = { id: store.nextUserId++, name: name, email: email, emailVerified: true };
  store.users.push(fresh);
  saveStore();
  res.status(201).json({ success: true, user: fresh, isNewUser: true });
});

app.get('/api/ratings', function (req, res) { res.json(store.ratings); });

app.get('/api/ratings/user/:userId', function (req, res) {
  var id = Number(req.params.userId);
  res.json(store.ratings.filter(function (r) { return r.userId === id; }));
});

app.post('/api/ratings', function (req, res) {
  var userId = Number(req.body && req.body.userId);
  var movieId = req.body && req.body.movieId;
  var rating = Number(req.body && req.body.rating);
  if (!userId || movieId === undefined || movieId === null || movieId === '') {
    return res.status(400).json({ error: 'userId, movieId, and rating are required' });
  }
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  var existing = store.ratings.find(function (r) {
    return r.userId === userId && String(r.movieId) === String(movieId);
  });
  if (existing) {
    existing.rating = rating;
    saveStore();
    return res.json(existing);
  }
  var record = { id: store.nextRatingId++, userId: userId, movieId: movieId, rating: rating };
  store.ratings.push(record);
  saveStore();
  res.status(201).json(record);
});

app.delete('/api/ratings/:id', function (req, res) {
  var id = Number(req.params.id);
  var before = store.ratings.length;
  store.ratings = store.ratings.filter(function (r) { return r.id !== id; });
  if (store.ratings.length === before) return res.status(404).json({ error: 'Rating not found' });
  saveStore();
  res.json({ success: true });
});

app.get('/api/stats', ensureReady, function (req, res) {
  res.json({
    movieCount: MOVIES.length,
    seriesCount: SERIES.length,
    tvCount: TV.length,
    animeCount: ANIME.length,
    userCount: store.users.length,
    ratingCount: store.ratings.length
  });
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

app.listen(PORT, function () {
  console.log('Filmphile running at http://localhost:' + PORT + ' (source: ' + SOURCE + ')');
  ready = loadCatalog().then(function () {
    console.log('Catalog ready: ' + MOVIES.length + ' movies, ' + SERIES.length + ' series, ' +
      TV.length + ' TV shows, ' + ANIME.length + ' anime loaded from ' + SOURCE);
  }).catch(function (err) {
    console.error('Catalog load failed:', err.message);
    ready = null;
  });
});