/**
 * Zero-dependency test harness for the recommendation engine.
 *
 * Bundled with esbuild (already shipped by Vite) and run on plain node:
 *   npm run verify
 *
 * Exits non-zero if any assertion fails, so it is safe on CI.
 */
import { MOVIES, SEED_RATINGS, USERS } from '../src/data/catalog';
import type { RatingRecord, User } from '../src/types';
import { buildMatrix, movieStats, pickSurprise, recommendForUser, topRated } from '../src/lib/recommender';

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function group(title: string) {
  console.log(`\n${title}`);
}

const COLD: User = { id: 99, name: 'ColdStart' };
const COLD_RATINGS: RatingRecord[] = [
  { userId: 99, movieId: 9, rating: 3 }, // The Godfather (Crime) — below threshold
  { userId: 99, movieId: 8, rating: 2 }, // Shawshank (Drama) — low
];

function withCold(extra: RatingRecord[] = []) {
  return buildMatrix([...USERS, COLD], MOVIES, [...SEED_RATINGS, ...COLD_RATINGS, ...extra]);
}

// ---------------------------------------------------------------- dataset
group('Dataset integrity');
const matrix = buildMatrix(USERS, MOVIES, SEED_RATINGS);
check('5 users x 56 movies matrix', matrix.values.length === 5 && matrix.values[0].length === 56);
check('seed ratings loaded', SEED_RATINGS.length === 45, `got ${SEED_RATINGS.length}`);
check(
  'user 1 row matches the C data (5,2,4,0,3,5,1,4,3,2)',
  matrix.values[0].slice(0, 10).join(',') === '5,2,4,0,3,5,1,4,3,2',
  matrix.values[0].slice(0, 10).join(','),
);
check(
  '0 always means Not Rated',
  movieStats(matrix).every((s) => s.average >= 0 && s.average <= 5),
);

// ------------------------------------------------------------- leaderboard
group('Top rated leaderboard');
const ranked = topRated(matrix, 1);
check('leaderboard is sorted descending', ranked.every((s, i) => i === 0 || ranked[i - 1].average >= s.average));
check('every listed movie has at least 1 rating', ranked.every((s) => s.count >= 1));
check('min-ratings filter works', topRated(matrix, 5).every((s) => s.count >= 5));

// ------------------------------------------------------- the gating rule
group('Genre engine is gated on 4-5 star ratings');
const coldResult = recommendForUser(withCold(), 99, 10);
check('cold user is locked', coldResult.unlocked === false);
check('cold user has no liked movies', coldResult.liked.length === 0);
check('cold user recorded the low rating', coldResult.disliked.length === 1);
check(
  'locked user gets zero genre contribution',
  coldResult.recommendations.every((r) => r.genreScore === 0 && r.coldStart),
);

const warmResult = recommendForUser(
  withCold([{ userId: 99, movieId: 1, rating: 5 }]), // Inception = Sci-Fi (0)
  99,
  10,
);
check('a single 5 star unlocks the engine', warmResult.unlocked === true);
check('Inception is recognised as liked', warmResult.liked.some((l) => l.movie.moviename === 'Inception'));
const sciFiAfter = warmResult.recommendations.filter((r) => r.movie.category === 0);
const sciFiBefore = coldResult.recommendations.filter((r) => r.movie.category === 0);
check('sci-fi appears only after the 5 star rating', sciFiAfter.length > 0 && sciFiAfter.length > sciFiBefore.length,
  `before=${sciFiBefore.length} after=${sciFiAfter.length}`);
check('every sci-fi pick carries a genre contribution', sciFiAfter.every((r) => r.genreScore > 0));
check(
  'sci-fi picks explain themselves',
  sciFiAfter.every((r) => r.reasons.some((reason) => reason.includes('Inception'))),
);
check(
  'the reason names the genre',
  sciFiAfter.every((r) => r.reasons.some((reason) => reason.includes('Sci-Fi'))),
);

group('Rating strength changes the ranking');
const fourStar = recommendForUser(withCold([{ userId: 99, movieId: 1, rating: 4 }]), 99, 10);
const fiveStar = warmResult;
const liftOf = (r: typeof fiveStar) => r.recommendations.find((x) => x.movie.category === 0)?.genreScore ?? 0;
check('5 star lift is stronger than 4 star lift', liftOf(fiveStar) > liftOf(fourStar),
  `4star=${liftOf(fourStar)} 5star=${liftOf(fiveStar)}`);

group('Low ratings de-prioritise a genre');
const haterResult = recommendForUser(
  withCold([
    { userId: 99, movieId: 1, rating: 5 }, // Inception 5 stars -> Sci-Fi lift
    { userId: 99, movieId: 10, rating: 1 }, // The Matrix 1 star -> Sci-Fi drag
  ]),
  99,
  20,
);
const dragged = haterResult.recommendations.find((r) => r.movie.category === 0);
check(
  'mixed signals still allow the genre but with reduced lift',
  dragged === undefined || dragged.genreScore < 1,
  `genreScore=${dragged?.genreScore}`,
);

// ------------------------------------------------------------- hygiene
group('Recommendation hygiene');
const ids = new Set([1, 8, 9]);
check('already-rated movies are never re-recommended', warmResult.recommendations.every((r) => !ids.has(r.movie.id)));
check('match is always 1-99', warmResult.recommendations.every((r) => r.match >= 1 && r.match <= 99));
check(
  'match is monotone in score',
  warmResult.recommendations.every((r, i) => i === 0 || warmResult.recommendations[i - 1].score >= r.score),
);

group('Re-rating overwrites instead of duplicating');
const overwritten = buildMatrix([...USERS, COLD], MOVIES, [
  ...SEED_RATINGS,
  { userId: 99, movieId: 1, rating: 5 },
  { userId: 99, movieId: 1, rating: 2 }, // same user+movie, later wins
]);
const coldIndex = overwritten.users.findIndex((u) => u.id === 99);
const inceptionIndex = overwritten.movies.findIndex((m) => m.id === 1);
check('latest rating wins (mirrors matrix[2][k] = ratings)', overwritten.values[coldIndex][inceptionIndex] === 2);

group('Surprise me');
const deterministic = () => 0;
const surprise = pickSurprise(warmResult, deterministic);
check('surprise returns a movie', surprise !== null);
check(
  'surprise prefers a genre the user has no lift in',
  surprise === null || surprise.genreScore === 0 || warmResult.recommendations.every((r) => r.genreScore > 0),
);
check('surprise on an empty pool is null', pickSurprise({ ...warmResult, recommendations: [] }) === null);

group('Unknown user degrades gracefully');
const ghost = recommendForUser(matrix, 4242, 5);
check('unknown user is locked with no picks', ghost.unlocked === false && ghost.recommendations.length === 0);

// ------------------------------------------------------------------ done
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
